const { execSync } = require('child_process');

console.log('Creating Netlify site automatically...\n');

try {
  // Create the site using the API
  const result = execSync(`
    source ~/.nvm/nvm.sh && 
    nvm use 18 && 
    netlify api createSite --data '{"name": "silver-fin-monitor-app", "repo": {"provider": "github", "repo": "scsilverstein/silver-fin-monitor"}}' 2>/dev/null || echo "Site might already exist"
  `, { 
    shell: '/bin/bash',
    encoding: 'utf8'
  });
  
  console.log('Site creation response:', result);
  
  // Now link the site
  console.log('\nLinking to the site...');
  execSync(`
    source ~/.nvm/nvm.sh && 
    nvm use 18 && 
    netlify link --name silver-fin-monitor-app
  `, { 
    shell: '/bin/bash',
    stdio: 'inherit'
  });
  
  console.log('\nDeploying to Netlify...');
  execSync(`
    source ~/.nvm/nvm.sh && 
    nvm use 18 && 
    netlify deploy --prod --dir frontend/dist
  `, { 
    shell: '/bin/bash',
    stdio: 'inherit'
  });
  
} catch (error) {
  console.error('Error:', error.message);
  console.log('\nTrying alternative approach...');
}