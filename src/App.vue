<script setup>
// 定义切片大小为 200KB（可根据需求调整）
const SIZE = 200 * 1024;

// 工作线程
const worker = new Worker(new URL('hash.js', import.meta.url));

async function handleFile(event) {
  // 获取文件
  const file = event.currentTarget.files;
  // 创建文件切片
  let fileChunkList = createFileChunk(file);
  // 获取文件哈希值
  worker.postMessage({ fileChunkList });
  const calcFileHash = new Promise(resolve => {
    worker.addEventListener('message', (event) => {
      if (event.hash) resolve(hash);
    })
  })
  const fileHash = await calcFileHash;
  // 完善切片信息
  fileChunkList = fileChunkList.map((chunk, index) => ({
    fileHash: fileHash, // 文件哈希值（用于标识所属文件）
    index, // 切片索引（用于合并时排序）
    hash: `${container.hash}-${index}`, // 切片哈希值（文件哈希值 + 索引）
    chunk, // 切片文件数据
    size: chunk.size, // 切片大小
  }))
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
    fileChunkList.push({
      chunk: file.slice(cur, cur + size), // 从当前位置截取到下一切片位置
    })
    cur += size // 移动到下一切片的起始位置
  }
  return fileChunkList
}
</script>

<template>
  <input type="file" @change="handleFile">
</template>

<style scoped></style>
