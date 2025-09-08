<script setup>
// 定义切片大小为 200KB（可根据需求调整）
const SIZE = 200 * 1024;

function handleFile() {
  
}

// 生成文件切片
function createFileChunk(file, size = SIZE) {
  const fileChunkList = []
  let cur = 0 // 当前截取位置
  while (cur < file.size) {
    // 推入对象而不是直接推入切片的原因：
    // 后续需要添加
    // --- 切片索引（index）和
    // --- 切片校验值（hash）
    fileChunkList.push({
      file: file.slice(cur, cur + size), // 从当前位置截取到下一切片位置
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
