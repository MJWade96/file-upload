import fse from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试目录
const testDir = path.resolve(__dirname, 'test_directory');

async function testRm() {
  try {
    // 创建测试目录和文件
    await fse.mkdirs(testDir);
    await fse.writeFile(path.join(testDir, 'test_file.txt'), 'Hello World');
    
    console.log('目录创建成功');
    
    // 尝试删除目录
    await fse.rm(testDir, { recursive: true });
    
    console.log('目录删除成功');
  } catch (error) {
    console.error('错误:', error);
  }
}

testRm();