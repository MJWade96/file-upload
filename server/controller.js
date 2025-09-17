import multiparty from 'multiparty'
import path, { resolve } from 'path'
import fse from 'fs-extra'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 总存储目录
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target') // 存储在项目文件夹下的 target 文件夹

function getFileData(request) {
	return new Promise(resolve => {
		let body = [];
		request
			.on('data', chunk => {
				body.push(chunk);
			})
			.on('end', () => {
				body = Buffer.concat(body).toString();
				resolve(JSON.parse(body));
			})
	})
}
async function createFile(chunkSize, fileHash, filename) {
	const chunkDir = path.resolve(UPLOAD_DIR, fileHash)
	const chunkPaths = await fse.readdir(chunkDir)
	chunkPaths.sort((a, b) => +a.split('-')[1] - +b.split('-')[1])
	const filePath = path.resolve(UPLOAD_DIR, filename)
	// 使用Promise.all并发处理所有切片的合并操作
	await Promise.all(
		chunkPaths.map((chunkPath, index) => {
			// 对每个切片调用pipeStream函数进行流处理
			return pipeStream(
				fse.createReadStream(path.resolve(chunkDir, chunkPath)),
				// 创建写入流，指定在目标文件中的写入位置
				// 通过start和end参数实现并发写入，提高合并效率
				fse.createWriteStream(filePath, {
					start: index * chunkSize,  // 当前切片在文件中的起始位置(索引从 0 开始)
					end: (index + 1) * chunkSize  // 当前切片在文件中的结束位置（索引从 0 开始，因此需要+1）
				})
			)
		})
	)
	// 删除切片目录`
	await fse.rm(chunkDir, { recursive: true });
}
async function handleMerge(request, response) {
	// 读取请求主体
	const body = await getFileData(request);
	// 提取请求主体中的数据
	const { chunkSize, fileHash, filename } = body;
	// 创建文件
	await createFile(chunkSize, fileHash, filename)
	response.end()
}
const pipeStream = (readStream, writeStream) => {
	return new Promise(resolve => {
		// 将可读流pipe到可写流，实现文件内容的复制
		readStream.pipe(writeStream);
		// 监听读取完成事件
		readStream.on('end', resolve)
	})
}
async function handleFormData(request, response) {
	const multipart = new multiparty.Form()
	multipart.parse(request, async (err, fields, files) => {
		const [chunk] = files.chunk
		const [hash] = fields.hash
		const [fileHash] = fields.fileHash

		const chunkDir = path.resolve(UPLOAD_DIR, fileHash)
		await fse.mkdirs(chunkDir) // 创建切片目录
		await fse.move(chunk.path, path.resolve(chunkDir, hash))
		response.end()
	})
}

export default {
	handleFormData,
	handleMerge
}