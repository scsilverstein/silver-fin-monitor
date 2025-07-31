const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, '../netlify/functions/api.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '../netlify/functions/api.js'),
      external: [
        '@netlify/functions',
        '@supabase/supabase-js',
        'express',
        'serverless-http',
        'cors',
        'helmet',
        'compression',
        'bcrypt',
        '@polygon.io/client-js'
      ],
      loader: {
        '.ts': 'ts'
      },
      tsconfig: path.join(__dirname, '../tsconfig.json'),
      logLevel: 'info'
    });
    console.log('✅ Netlify function built successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();