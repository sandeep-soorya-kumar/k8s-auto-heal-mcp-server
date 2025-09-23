const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('yaml');

const router = express.Router();
const execAsync = promisify(exec);

// Git operations
router.get('/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('git status --porcelain');
    const status = stdout.trim().split('\n').filter(line => line).map(line => {
      const [status, file] = line.split(' ', 2);
      return { status, file };
    });
    
    res.json({ status: 'success', data: status });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/branches', async (req, res) => {
  try {
    const { stdout } = await execAsync('git branch -a');
    const branches = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\*?\s+/, '').trim());
    
    res.json({ status: 'success', data: branches });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/commits/:limit?', async (req, res) => {
  try {
    const limit = req.params.limit || 10;
    const { stdout } = await execAsync(`git log --oneline -${limit}`);
    const commits = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      });
    
    res.json({ status: 'success', data: commits });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/commit', async (req, res) => {
  try {
    const { message, files } = req.body;
    
    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Commit message is required' });
    }
    
    // Add files if specified
    if (files && files.length > 0) {
      await execAsync(`git add ${files.join(' ')}`);
    } else {
      await execAsync('git add .');
    }
    
    // Commit
    await execAsync(`git commit -m "${message}"`);
    
    res.json({ status: 'success', message: 'Commit created successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/push', async (req, res) => {
  try {
    const { branch = 'main' } = req.body;
    await execAsync(`git push origin ${branch}`);
    
    res.json({ status: 'success', message: 'Changes pushed successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/pull', async (req, res) => {
  try {
    const { branch = 'main' } = req.body;
    await execAsync(`git pull origin ${branch}`);
    
    res.json({ status: 'success', message: 'Changes pulled successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Helm chart operations
router.get('/charts', async (req, res) => {
  try {
    const helmDir = path.join(process.cwd(), 'helm');
    const entries = await fs.readdir(helmDir, { withFileTypes: true });
    
    const charts = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const chartPath = path.join(helmDir, entry.name);
        const chartYamlPath = path.join(chartPath, 'Chart.yaml');
        const valuesYamlPath = path.join(chartPath, 'values.yaml');
        
        try {
          const chartContent = await fs.readFile(chartYamlPath, 'utf8');
          const valuesContent = await fs.readFile(valuesYamlPath, 'utf8');
          
          const chartData = yaml.parse(chartContent);
          const valuesData = yaml.parse(valuesContent);
          
          charts.push({
            name: entry.name,
            chart: chartData,
            values: valuesData,
            path: `helm/${entry.name}`
          });
        } catch (error) {
          console.warn(`Error reading chart ${entry.name}:`, error.message);
        }
      }
    }
    
    res.json({ status: 'success', data: charts });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/charts/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const chartPath = path.join(process.cwd(), 'helm', name);
    const chartYamlPath = path.join(chartPath, 'Chart.yaml');
    const valuesYamlPath = path.join(chartPath, 'values.yaml');
    
    const chartContent = await fs.readFile(chartYamlPath, 'utf8');
    const valuesContent = await fs.readFile(valuesYamlPath, 'utf8');
    
    const chartData = yaml.parse(chartContent);
    const valuesData = yaml.parse(valuesContent);
    
    res.json({ 
      status: 'success', 
      data: {
        name,
        chart: chartData,
        values: valuesData,
        path: `helm/${name}`
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.put('/charts/:name/values', async (req, res) => {
  try {
    const { name } = req.params;
    const { values } = req.body;
    
    const valuesYamlPath = path.join(process.cwd(), 'helm', name, 'values.yaml');
    const yamlContent = yaml.stringify(values, { indent: 2 });
    
    await fs.writeFile(valuesYamlPath, yamlContent);
    
    res.json({ status: 'success', message: 'Values updated successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
