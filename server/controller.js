import multiparty from 'multiparty'
import path from 'path'
import fse from 'fs-extra'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 总存储目录
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target') // 存储在项目文件夹下的 target 文件夹

async function handleFormData(req, res) {
	const multipart = new multiparty.Form()
	multipart.parse(req, async (err, fields, files) => {
		const [chunk] = files.chunk
		const [hash] = fields.hash
		const [fileHash] = fields.fileHash

		const chunkDir = path.resolve(UPLOAD_DIR, fileHash)
		await fse.mkdirs(chunkDir) // 创建切片目录
		fse.move(chunk.path, path.resolve(chunkDir, hash))
		res.end()
	})
}

export default {
	handleFormData
}
