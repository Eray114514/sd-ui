import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function scanAndImportImages() {
  console.log('=== 开始扫描图片目录 ===\n');

  const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
  const imageDir = config?.imageDir || path.join(process.env.USERPROFILE || process.env.HOME, 'ai_images');

  console.log('图片目录:', imageDir);
  console.log('目录存在:', fs.existsSync(imageDir));

  if (!fs.existsSync(imageDir)) {
    console.error('图片目录不存在!');
    return;
  }

  const files = fs.readdirSync(imageDir).filter(f =>
    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
  );

  console.log('找到图片文件:', files.length, '\n');

  if (files.length === 0) {
    console.log('没有找到图片文件');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(imageDir, file);

    const existingImage = await prisma.generatedImage.findFirst({
      where: { path: filePath }
    });

    if (existingImage) {
      skipped++;
      continue;
    }

    const stats = fs.statSync(filePath);
    const createdAt = stats.birthtime;

    const filenameParts = file.split('_');
    let taskId = null;

    if (filenameParts.length >= 2) {
      const possibleTaskId = filenameParts[1];
      if (possibleTaskId && possibleTaskId.length > 5) {
        const existingTask = await prisma.task.findFirst({
          where: { id: possibleTaskId }
        });
        if (existingTask) {
          taskId = existingTask.id;
        }
      }
    }

    if (!taskId) {
      const filenameWithoutExt = path.basename(file, path.extname(file));
      const fakeTask = await prisma.task.create({
        data: {
          id: `recovery_${filenameWithoutExt}_${Date.now()}`,
          prompt: '[已恢复的图片] ' + filenameWithoutExt,
          negative_prompt: '',
          styles: '[]',
          sampler_name: '未知',
          scheduler: '未知',
          steps: 0,
          cfg_scale: 0,
          width: 0,
          height: 0,
          n_iter: 1,
          batch_size: 1,
          seed: 0,
          model_checkpoint: '未知',
          status: 'completed',
        }
      });
      taskId = fakeTask.id;
    }

    await prisma.generatedImage.create({
      data: {
        path: filePath,
        taskId: taskId,
        isFavorite: false,
        createdAt: createdAt,
      }
    });

    imported++;
    if (imported % 50 === 0) {
      console.log(`已导入 ${imported} 张图片...`);
    }
  }

  console.log('\n=== 导入完成 ===');
  console.log('新增导入:', imported);
  console.log('已存在跳过:', skipped);
  console.log('总计:', imported + skipped);

  const finalImageCount = await prisma.generatedImage.count();
  const finalTaskCount = await prisma.task.count();
  console.log('\n数据库当前状态:');
  console.log('图片记录:', finalImageCount);
  console.log('任务记录:', finalTaskCount);

  await prisma.$disconnect();
}

scanAndImportImages().catch(console.error);