// Upload 6 BokGak gift images to Supabase Storage and update DB
// Run: node --env-file=.env.local scripts/upload-bokgak-gifts.mjs

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import sharp from 'sharp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets';
const SOURCE_DIR = '/Users/iniru/Downloads/drive-download-20260405T214924Z-1-001';

const GIFTS = [
  { file: 'Trial Extraction   A.B.S.png',                    game_id: 9243 },
  { file: 'Trial Extraction   Lantern.png',                  game_id: 9244 },
  { file: 'Modified Extraction   AEDD.png',                  game_id: 9245 },
  { file: 'Someone_s Dropped Employee Card.png',             game_id: 9246 },
  { file: 'Spicebush, Glasses, and Mailed Letter.png',       game_id: 9248 },
  { file: 'A Small, Lovely Violin.png',                      game_id: 9249 },
];

async function main() {
  const total = GIFTS.length;

  for (let i = 0; i < total; i++) {
    const { file, game_id } = GIFTS[i];
    const srcPath = `${SOURCE_DIR}/${file}`;

    console.log(`[${i + 1}/${total}] Processing game_id=${game_id} — ${file}`);

    // 1. Read PNG and convert to WebP
    const pngBuffer = readFileSync(srcPath);
    const webpBuffer = await sharp(pngBuffer).webp({ quality: 90 }).toBuffer();

    // 2. Compute 8-char MD5 hash of the WebP buffer
    const md5 = createHash('md5').update(webpBuffer).digest('hex').slice(0, 8);
    const storagePath = `ego-gifts/ego-gift-${md5}.webp`;
    const publicUrl = `${STORAGE_BASE}/${storagePath}`;

    console.log(`    Storage path: ${storagePath}`);

    // 3. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('limbus-assets')
      .upload(storagePath, webpBuffer, { contentType: 'image/webp', upsert: true });

    if (uploadError) {
      console.error(`    Upload FAILED: ${uploadError.message}`);
      // Retry once
      const { error: retryError } = await supabase.storage
        .from('limbus-assets')
        .upload(storagePath, webpBuffer, { contentType: 'image/webp', upsert: true });
      if (retryError) {
        console.error(`    Retry FAILED: ${retryError.message} — skipping`);
        continue;
      }
    }

    console.log(`    Uploaded OK`);

    // 4. Update image_url in DB
    const { error: dbError } = await supabase
      .schema('limbus')
      .from('ego_gifts')
      .update({ image_url: publicUrl })
      .eq('game_id', game_id);

    if (dbError) {
      console.error(`    DB update FAILED: ${dbError.message}`);
    } else {
      console.log(`    DB updated: game_id=${game_id} → ${publicUrl}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  // 5. Verify final state
  console.log('\n--- Verification ---');
  const { data, error } = await supabase
    .schema('limbus')
    .from('ego_gifts')
    .select('game_id, name, image_url')
    .in('game_id', GIFTS.map(g => g.game_id))
    .order('game_id');

  if (error) {
    console.error('Verification query failed:', error.message);
  } else {
    data.forEach(r => console.log(`  game_id=${r.game_id} | ${r.name} | ${r.image_url ?? 'NULL'}`));
    const missing = data.filter(r => !r.image_url);
    if (missing.length === 0) {
      console.log('\nAll 6 gifts have image_url set.');
    } else {
      console.warn(`\n${missing.length} gift(s) still missing image_url:`, missing.map(r => r.game_id));
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
