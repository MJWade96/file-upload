<script setup>
import { watch, computed, ref } from 'vue';
// 定义切片大小为 200KB（可根据需求调整）
const SIZE = 200 * 1024;
let file;
let fileHash;
const fileHashProgress = ref(0);
const fileChunkList = ref([]); // 切片列表
const requestList = [];
const hash = ref('');
// 工作线程
const worker = new Worker(new URL('hash.js', import.meta.url), { type: 'module' });

async function handleFile(event) {
  // 获取文件
  file = event.currentTarget.files[0];

  // 创建文件切片
  const temp = createFileChunks(file);

  // 获取文件哈希值
  fileChunkList.value = temp;
  worker.postMessage({ fileChunkList: temp });
  const calcFileHash = new Promise(resolve => {
    worker.addEventListener('message', (event) => {
      fileHashProgress.value = event.data.percentage;
      if (event.data.hash) {
        resolve(event.data.hash);
      }
    })
  })
  fileHash = await calcFileHash;
  hash.value = fileHash;

  handleUpload();
}

async function handleUpload() {
  // 获取已上传的切片
  const { uploaded, uploadedChunks } = await verifyUploadedFile(fileHash, file.name);
  if (uploaded) {
    fakeUploadProgress.value = 100;
    console.log('文件已上传');
    return;
  }
  // 完善切片信息
  fileChunkList.value = fileChunkList.value.map(({ chunk }, chunkIndex) => ({
    fileHash, // 文件哈希值（用于标识所属文件）
    chunkIndex, // 切片索引（用于合并时排序）
    hash: `${fileHash}-${chunkIndex}`, // 切片哈希值（文件哈希值 + 索引）
    chunk, // 切片文件数据
    size: chunk.size, // 切片大小
    progress: uploadedChunks.includes(`${fileHash}-${chunkIndex}`) ? 100 : 0, // 切片上传进度
  }))
  // 过滤出未上传的切片
  const unuploadedChunks = fileChunkList.value.filter(chunk => !uploadedChunks.includes(chunk.hash));
  // 调用上传函数
  uploadChunks(file, unuploadedChunks);
}

// 生成文件切片
function createFileChunks(file, size = SIZE) {
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

async function verifyUploadedFile(fileHash, fileName) {
  const { uploaded, uploadedChunks } = await request({
    url: 'http://localhost:9999/verify',
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify({ fileHash, fileName })
  })
  return { uploaded, uploadedChunks };
}

async function uploadChunks(file, fileChunkList) {
  const requestList = fileChunkList.map(item => {
    const formData = new FormData();
    const { chunk, hash, fileHash, chunkIndex } = item;
    // 切片文件
    formData.append('chunk', chunk);
    // 切片文件hash
    formData.set('hash', hash)
    // 大文件的文件名
    formData.set('filename', file.name)
    // 大文件hash
    formData.set('fileHash', fileHash)
    return { formData, chunkIndex }
  }).map(async ({ formData, chunkIndex }) =>
    request({
      url: 'http://localhost:9999',
      data: formData,
      progressHandler: createProgressHandler(chunkIndex), // 上传进度回调函数
    })
  );
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
  data,
  method = 'POST', // HTTP方法，默认为POST
  progressHandler = null, // 上传进度回调函数
}) {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    requestList.push(xhr);
    xhr.responseType = 'json';
    xhr.onload = () => {
      requestList.splice(requestList.indexOf(xhr), 1);
      resolve(xhr.response);
    };
    if (progressHandler) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          progressHandler(percentComplete);
        }
      });
    }
    // 注意, 根据 MDN 文档, 需要在 open 和 send 方法之前在 xhr.upload 上添加监听器
    // [信息来源] https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload
    xhr.open(method, url);
    xhr.send(data);
  })
}

function createProgressHandler(chunkIndex) {
  return (percentComplete) => {
    fileChunkList.value[chunkIndex].progress = percentComplete;
  }
}
const uploadProgress = computed(() => {
  if (fileChunkList.value.length === 0 || !file) return 0; // 避免除数为0的情况
  console.log('fileChunkList.value:', fileChunkList.value)
  const totalProgress = fileChunkList.value.reduce((total, item) => total + item.progress * SIZE, 0);
  return parseInt((totalProgress / file.size).toFixed(2)); // 保留两位小数
})
const fakeUploadProgress = ref(0); // 模拟上传进度
watch(uploadProgress, (now) => {
  if (now > fakeUploadProgress.value) {
    fakeUploadProgress.value = now;
  }
})

</script>

<template>
  <input type="file" @change="handleFile">
  <p>文件哈希值：{{ hash }}</p>
  <button @click="stopUpload">停止上传</button>
  <button @click="handleUpload">恢复上传</button>
  <label>
    哈希值计算进度: <progress :value="fileHashProgress" max="100"></progress>
  </label>
  <label>
    上传进度: <progress :value="fakeUploadProgress" max="100"></progress>
  </label>

</template>

<style scoped></style>