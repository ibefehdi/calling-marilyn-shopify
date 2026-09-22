#!/usr/bin/env node
/**
 * Upload Moment Magnets gallery images via Shopify CLI store execute + staged uploads.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, statSync } from 'node:fs';
import { basename } from 'node:path';

const STORE = 'jkew4n-yy.myshopify.com';
const PRODUCT_ID = 'gid://shopify/Product/8043631083563';
const AGENT = {
  SHOPIFY_CLI_AGENT_INFO: 'n:Cursor|v:1.0|p:Cursor',
  SHOPIFY_CLI_AGENT_IDS: 's:90e8ffa7-cc96-4178-813a-1bfb3aad18a3|r:add-images|i:2',
};

const IMAGES = [
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/patterns_5-e0fbc93d-adf3-4f47-8b46-12e99bf84a49.png',
    filename: 'moment-magnet-marble.png',
    alt: 'Moment Magnet — marble wave frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/Fridge_magnet_Picnic_frame-0a16162c-8f03-4226-b265-c42fb74885b7.png',
    filename: 'moment-magnet-picnic.png',
    alt: 'Moment Magnet — picnic fruit frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/magnet_stars-5f155083-c525-4268-8192-0ec00b1b4253.png',
    filename: 'moment-magnet-gold-stars.png',
    alt: 'Moment Magnet — blue gold stars frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/magnet_chrome_-a90c5120-ccff-44ea-97f2-986c7eb503b5.png',
    filename: 'moment-magnet-chrome.png',
    alt: 'Moment Magnet — holographic chrome frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/fridge_ramadan_-ed2d0921-38f4-40eb-97ae-f582c709c399.png',
    filename: 'moment-magnet-ramadan-stars.png',
    alt: 'Moment Magnet — black star frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/fridge_magnets_stars-e34e2ea5-feec-4518-85ed-45155774045c.png',
    filename: 'moment-magnet-cream-stars.png',
    alt: 'Moment Magnet — cream star frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/magnets_heats_-48fcc5ab-11f2-4dfd-be19-f34667ecdff1.png',
    filename: 'moment-magnet-hearts.png',
    alt: 'Moment Magnet — pink hearts frame',
  },
  {
    path: '/Users/fahadasad/.cursor/projects/Users-fahadasad-Documents-calling-marilyn-shopify/assets/patterns_10-e764f900-b66a-4383-a50a-15d4a600092d.png',
    filename: 'moment-magnet-harlequin.png',
    alt: 'Moment Magnet — harlequin frame',
  },
];

function shopifyExecute(query, variables) {
  const args = [
    'store',
    'execute',
    '--store',
    STORE,
    '--allow-mutations',
    '--json',
    '--query',
    query,
  ];
  if (variables) {
    args.push('--variables', JSON.stringify(variables));
  }
  const out = execFileSync('shopify', args, {
    encoding: 'utf8',
    env: { ...process.env, ...AGENT },
    maxBuffer: 20 * 1024 * 1024,
  });
  // Strip CLI progress noise; keep JSON object
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON in shopify output:\n${out}`);
  }
  return JSON.parse(out.slice(start, end + 1));
}

async function uploadFile(file, target) {
  const form = new FormData();
  for (const { name, value } of target.parameters) {
    form.append(name, value);
  }
  const { readFileSync } = await import('node:fs');
  const bytes = readFileSync(file.path);
  form.append('file', new Blob([bytes], { type: 'image/png' }), file.filename);

  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for ${file.filename}: ${res.status} ${text}`);
  }
  return target.resourceUrl;
}

async function main() {
  const stagedInput = IMAGES.map((img) => ({
    filename: img.filename,
    mimeType: 'image/png',
    httpMethod: 'POST',
    resource: 'PRODUCT_IMAGE',
    fileSize: String(statSync(img.path).size),
  }));

  console.log('Creating staged upload targets...');
  const staged = shopifyExecute(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    { input: stagedInput },
  );

  const errors = staged.stagedUploadsCreate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(`stagedUploadsCreate errors: ${JSON.stringify(errors)}`);
  }
  const targets = staged.stagedUploadsCreate.stagedTargets;
  if (targets.length !== IMAGES.length) {
    throw new Error(`Expected ${IMAGES.length} targets, got ${targets.length}`);
  }

  console.log('Uploading files to Shopify storage...');
  const resourceUrls = [];
  for (let i = 0; i < IMAGES.length; i++) {
    const url = await uploadFile(IMAGES[i], targets[i]);
    console.log(`  uploaded ${IMAGES[i].filename}`);
    resourceUrls.push(url);
  }

  console.log('Attaching images to product (shared by both variants)...');
  const media = resourceUrls.map((originalSource, i) => ({
    originalSource,
    alt: IMAGES[i].alt,
    mediaContentType: 'IMAGE',
  }));

  const result = shopifyExecute(
    `mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          alt
          mediaContentType
          status
          ... on MediaImage { id }
        }
        mediaUserErrors { field message }
        product { id title media(first: 20) { nodes { alt ... on MediaImage { id image { url } } } } }
      }
    }`,
    { productId: PRODUCT_ID, media },
  );

  const mediaErrors = result.productCreateMedia?.mediaUserErrors ?? [];
  if (mediaErrors.length) {
    throw new Error(`productCreateMedia errors: ${JSON.stringify(mediaErrors)}`);
  }

  console.log(JSON.stringify(result.productCreateMedia, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
