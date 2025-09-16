import SparkMD5 from 'spark-md5'

self.onmessage = e => {
        const { fileChunkList } = e.data
    const spark = new SparkMD5.ArrayBuffer() // 创建SparkMD5实例
    let percentage = 0 // 计算进度
    const percentInterval = 100 / fileChunkList.length;
    let count = 0 // 已处理的切片数量
    
    
    // 开始处理第一个切片
    loadNext(count)

    // 递归处理所有切片
    async function loadNext(index) {
                const fileChunk = fileChunkList[index].chunk;
        // 读取当前切片的ArrayBuffer
        const chunkBuffer = await fileChunk.arrayBuffer();
        // 将当前切片的内容添加到哈希计算中
        spark.append(chunkBuffer);
        count++
        if (count < fileChunkList.length) {
            // 计算当前进度并发送给主线程
            percentage += percentInterval;
            self.postMessage({ percentage })
            loadNext(count) // 处理下一个切片
        } else {
            // 处理完所有切片后，计算最终hash
            const hash = spark.end(); // 生成最终hash值
                        self.postMessage({
                percentage: 100,
                hash: hash
            })
            self.close() // 关闭Worker            
        }
    }
}