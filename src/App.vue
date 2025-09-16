<script setup>
// 定义切片大小为 200KB（可根据需求调整）
const SIZE = 200 * 1024;

// 工作线程
const worker = new Worker(new URL('hash.js', import.meta.url), { type: 'module' });

async function handleFile(event) {
  // 获取文件
  const file = event.currentTarget.files[0];
  console.log('Selected file:', file);

  // 创建文件切片
  let fileChunkList = createFileChunk(file);
  console.log('File chunks created:', fileChunkList.length);

  // 获取文件哈希值
  worker.postMessage({ fileChunkList });
  console.log('Posted file chunks to worker');

  const calcFileHash = new Promise(resolve => {
    worker.addEventListener('message', (event) => {
      console.log('Received message from worker:', event.data);
      if (event.data.hash) {
        resolve(event.data.hash);
      }
    })
  })
  const fileHash = await calcFileHash;
  console.log('File hash calculated:', fileHash);

  // 完善切片信息
  fileChunkList = fileChunkList.map(({ chunk }, index) => ({
    fileHash: fileHash, // 文件哈希值（用于标识所属文件）
    index, // 切片索引（用于合并时排序）
    hash: `${fileHash}-${index}`, // 切片哈希值（文件哈希值 + 索引）
    chunk, // 切片文件数据
    size: chunk.size, // 切片大小
  }))

  console.log('File chunk list with hash:', fileChunkList);

  // 调用上传函数
  uploadChunks(file, fileChunkList);
}

// 生成文件切片
function createFileChunk(file, size = SIZE) {
  const fileChunkList = []
  let cur = 0; // 当前截取位置
  while (cur < file.size) {
    // 推入对象而不是直接推入切片的原因：
    // 后续需要添加
    // --- 切片索引（index）和
    // --- 切片校验值（hash）
    fileChunkList.push({ chunk: file.slice(cur, cur + size) }) // 从当前位置截取到下一切片位置
    cur += size // 移动到下一切片的起始位置
  }
  return fileChunkList
}

async function uploadChunks(file, fileChunkList) {
  console.log('Starting upload of chunks');

  const requestList = fileChunkList.map(item => {
    const formData = new FormData();
    const { chunk, hash, fileHash, index } = item;
    console.log(chunk);
    // 切片文件
    formData.append('chunk', chunk);
    // 切片文件hash
    formData.set('hash', hash)
    // 大文件的文件名
    formData.set('filename', file.name)
    // 大文件hash
    formData.set('fileHash', fileHash)
    console.log('数据：', formData.entries());
    return { formData, index }
  }).map(async ({ formData }) =>
    request({
      url: 'http://localhost:9999',
      data: formData,
    })
  )
  // 并发上传
  await Promise.all(requestList);
  console.log('All chunks uploaded');
}

function request({
  url,
  method = 'post',
  data,
}) {
  // console.log('数据：', data);
  const xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.send(data);
  console.log('Request sent for chunk');
}
</script>

<template>
  <input type="file" @change="handleFile">
</template>

<style scoped></style>