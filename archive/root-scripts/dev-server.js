#!/usr/bin/env node

const { spawn } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

console.log('🚀 Starting Silver Fin Monitor Development Server...\n');

// Function to build the Netlify function
function buildFunction() {
  console.log('📦 Building Netlify function...');
  return new Promise((resolve, reject) => {
    const build = spawn('npx', [
      'esbuild',
      'netlify/functions/api.ts',
      '--bundle',
      '--platform=node',
      '--outfile=netlify/functions/api.js',
      '--external:aws-sdk'
    ], { stdio: 'inherit' });

    build.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Function built successfully\n');
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
}

// Initial build
buildFunction().then(() => {
  // Watch for changes in the api.ts file
  const watcher = chokidar.watch('netlify/functions/api.ts', {
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', async () => {
    console.log('\n🔄 File changed, rebuilding...');
    try {
      await buildFunction();
    } catch (error) {
      console.error('❌ Build error:', error.message);
    }
  });

  // Start Netlify dev server
  console.log('🌐 Starting Netlify dev server...\n');
  const netlify = spawn('netlify', ['dev', '--port', '8888'], { 
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  netlify.on('error', (error) => {
    console.error('❌ Netlify dev error:', error);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    watcher.close();
    netlify.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    watcher.close();
    netlify.kill();
    process.exit(0);
  });
});