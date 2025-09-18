<script setup>
import { ref } from 'vue';
// 定义切片大小为 200KB（可根据需求调整）
const SIZE = 200 * 1024;
let file;
let fileChunkList;
const requestList = [];
const hash = ref('');
let fileHash;
// 工作线程
const worker = new Worker(new URL('hash.js', import.meta.url), { type: 'module' });

async function handleFile(event) {
  // 获取文件
  file = event.currentTarget.files[0];

  // 创建文件切片
  fileChunkList = createFileChunk(file);

  // 获取文件哈希值
  worker.postMessage({ fileChunkList });
  const calcFileHash = new Promise(resolve => {
    worker.addEventListener('message', (event) => {
      if (event.data.hash) {
        resolve(event.data.hash);
      }
    })
  })
  fileHash = await calcFileHash;
  hash.value = fileHash;

  // 完善切片信息
  fileChunkList = fileChunkList.map(({ chunk }, index) => ({
    fileHash: fileHash, // 文件哈希值（用于标识所属文件）
    index, // 切片索引（用于合并时排序）
    hash: `${fileHash}-${index}`, // 切片哈希值（文件哈希值 + 索引）
    chunk, // 切片文件数据
    size: chunk.size, // 切片大小
  }))
  handleUpload();
}

async function handleUpload() {
    // 获取已上传的切片
  const uploadedChunks = await getUploadedChunks(fileHash);
  // 过滤出未上传的切片
  const unuploadedChunks = fileChunkList.filter(chunk => !uploadedChunks.includes(chunk.hash));
  // 调用上传函数
  uploadChunks(file, unuploadedChunks);
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

async function getUploadedChunks(fileHash) {
  const { data: uploadedChunks } = await request({
    url: 'http://localhost:9999/verify',
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify({ fileHash })
  })
  return uploadedChunks;
}

async function uploadChunks(file, fileChunkList) {
  const requestList = fileChunkList.map(item => {
    const formData = new FormData();
    const { chunk, hash, fileHash, index } = item;
    // 切片文件
    formData.append('chunk', chunk);
    // 切片文件hash
    formData.set('hash', hash)
    // 大文件的文件名
    formData.set('filename', file.name)
    // 大文件hash
    formData.set('fileHash', fileHash)
    return { formData, index }
  }).map(async ({ formData }) =>
    request({
      url: 'http://localhost:9999',
      data: formData,
    })
  )
  await Promise.all(requestList);  // 并发上传
  mergeRequest(SIZE, fileHash, file.name) // 合并切片请求
}

async function mergeRequest(chunkSize, fileHash, filename) {
  request({
    url: 'http://localhost:9999/merge',
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify({
      chunkSize,
      fileHash,
      filename
    }),
  })
}

function stopUpload() {
  requestList.map(request => request.abort());
}

function request({
  url,
  method = 'post',
  data,
}) {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    requestList.push(xhr);
    xhr.responseType = 'json';
    xhr.open(method, url);
    xhr.send(data);
    xhr.onload = () => {
      requestList.splice(requestList.indexOf(xhr), 1);
      resolve(xhr.response);
    };
  })
}
</script>

<template>
  <input type="file" @change="handleFile">
  <p>文件哈希值：{{ hash }}</p>
  <button @click="stopUpload">停止上传</button>
  <button @click="handleUpload">恢复上传</button>
</template>

<style scoped></style>