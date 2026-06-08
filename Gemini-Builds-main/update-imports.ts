import fs from 'fs';
import path from 'path';

const dir = 'src/pages/local';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/from '\.\/FileUploader'/g, "from '../../components/FileUploader'");
  content = content.replace(/from '\.\/ProcessingOverlay'/g, "from '../../components/ProcessingOverlay'");
  content = content.replace(/from '\.\/PDFThumbnail'/g, "from '../../components/PDFThumbnail'");
  content = content.replace(/from '\.\.\/hooks/g, "from '../../hooks");
  fs.writeFileSync(filePath, content);
}

console.log("Done");
