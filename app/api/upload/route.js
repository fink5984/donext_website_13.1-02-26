import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const campaignId = formData.get('campaignId');
  
  if (!file || !campaignId) {
    return NextResponse.json({ error: 'Missing file or campaignId' }, { status: 400 });
  }
  
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', campaignId);
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filename = `${Date.now()}-${file.name}`;
  const filepath = path.join(uploadDir, filename);
  await fs.writeFile(filepath, buffer);
  
  const url = `/uploads/${campaignId}/${filename}`;
  return NextResponse.json({ url });
}





