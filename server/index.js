const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3333;

// 中间件
app.use(cors());
app.use(express.json());

// API 1: 获取所有项目列表
app.get('/api/projects', (req, res) => {
  try {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude.json');

    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: '配置文件不存在' });
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    const projects = config.projects || {};

    // 将 projects 对象转换为数组格式
    const projectList = Object.entries(projects).map(([projectPath, projectInfo]) => {
      // 从路径中提取项目名称（最后一个目录名）
      const projectName = path.basename(projectPath) || projectPath;

      return {
        path: projectPath,
        name: projectName,
        lastSessionId: projectInfo.lastSessionId || null
      };
    });

    res.json({
      success: true,
      projects: projectList
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API 2: 获取指定项目下的会话列表
app.get('/api/sessions', (req, res) => {
  try {
    const { path: projectPath } = req.query;

    if (!projectPath) {
      return res.status(400).json({ error: '缺少 path 参数' });
    }

    const homeDir = os.homedir();
    const projectsBaseDir = path.join(homeDir, '.claude', 'projects');

    if (!fs.existsSync(projectsBaseDir)) {
      return res.json({ success: true, sessions: [] });
    }

    // 获取配置文件中的项目信息，用于获取 lastSessionId
    const configPath = path.join(homeDir, '.claude.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const projects = config.projects || {};
    const projectInfo = projects[projectPath];

    // 获取所有项目目录
    const projectDirs = fs.readdirSync(projectsBaseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    // 尝试匹配项目路径
    let matchedDir = null;

    // 方法1: 使用 lastSessionId 匹配（最可靠，适用于中文项目名）
    if (projectInfo && projectInfo.lastSessionId) {
      const lastSessionId = projectInfo.lastSessionId;
      for (const dir of projectDirs) {
        const sessionDir = path.join(projectsBaseDir, dir);
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir);
          if (files.includes(lastSessionId + '.jsonl')) {
            matchedDir = dir;
            break;
          }
        }
      }
    }

    // 方法2: 尝试通过路径片段匹配
    if (!matchedDir) {
      const pathParts = projectPath.split('/').filter(Boolean);
      const projectName = pathParts[pathParts.length - 1];

      // 先尝试精确匹配项目名结尾的目录
      matchedDir = projectDirs.find(dir => dir.endsWith(projectName));

      // 如果没找到，尝试包含路径最后一个目录名的
      if (!matchedDir && projectName) {
        matchedDir = projectDirs.find(dir => dir.includes(projectName));
      }
    }

    if (!matchedDir) {
      return res.json({ success: true, sessions: [] });
    }

    const sessionDir = path.join(projectsBaseDir, matchedDir);

    if (!fs.existsSync(sessionDir)) {
      return res.json({ success: true, sessions: [] });
    }

    // 读取目录下的所有文件
    const files = fs.readdirSync(sessionDir);

    // 过滤出 JSONL 文件，排除目录和 settings 文件
    const sessionFiles = files
      .filter(file => file.endsWith('.jsonl') && !file.toLowerCase().includes('settings'))
      .map(file => {
        const filePath = path.join(sessionDir, file);
        const stats = fs.statSync(filePath);

        return {
          id: file.replace('.jsonl', ''),
          filename: file,
          path: filePath,
          modifiedAt: stats.mtime
        };
      })
      // 按修改时间倒序排列
      .sort((a, b) => b.modifiedAt - a.modifiedAt);

    res.json({
      success: true,
      sessions: sessionFiles
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API 3: 获取会话详情（解析对话数据）
app.get('/api/session-detail', (req, res) => {
  try {
    const { filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({ error: '缺少 filePath 参数' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 读取 JSONL 文件（每行一个 JSON 对象）
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.trim().split('\n');

    // 解析每一行并提取会话信息
    let sessionId = '';
    const rawMessages = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        // 提取 sessionId
        if (data.sessionId && !sessionId) {
          sessionId = data.sessionId;
        }

        // 收集用户和助手消息
        if (data.type === 'user' || data.type === 'assistant') {
          rawMessages.push(data);
        } else if (data.message) {
          // 处理嵌套在 message 字段中的数据
          const messageType = data.type;
          const messageContent = data.message;

          if (messageType === 'user' || messageType === 'assistant') {
            rawMessages.push({
              type: messageType,
              message: messageContent
            });
          }
        }
      } catch (e) {
        // 跳过解析失败的行
        continue;
      }
    }

    // 解析每条消息为标准格式
    const parsedMessages = rawMessages
      .map(item => {
        const msg = item.message || item;

        // 提取角色
        let role = 'assistant';
        if (msg.role === 'user') {
          role = 'user';
        } else if (msg.role === 'assistant' || msg.type === 'assistant') {
          role = 'assistant';
        }

        // 提取内容
        let content = '';
        let toolCalls = [];

        if (msg.content) {
          if (Array.isArray(msg.content)) {
            // 处理内容是数组的情况
            const textParts = msg.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join('\n');

            const toolUseParts = msg.content
              .filter(item => item.type === 'tool_use')
              .map(item => ({
                id: item.id,
                type: 'function',
                function: {
                  name: item.name,
                  arguments: typeof item.input === 'string' ? item.input : JSON.stringify(item.input)
                }
              }));

            content = textParts;
            toolCalls = toolUseParts;
          } else if (typeof msg.content === 'string') {
            content = msg.content;
          }
        }

        // 处理 tool_calls 字段
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          toolCalls = msg.tool_calls.map(tc => ({
            id: tc.id || '',
            type: tc.type || 'function',
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || ''
            }
          }));
        }

        return {
          role,
          content: content || '',
          toolCalls
        };
      })
      .filter(msg => msg.role && (msg.content || msg.toolCalls.length > 0));

    res.json({
      success: true,
      sessionId: sessionId || path.basename(filePath, '.jsonl'),
      messages: parsedMessages
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API 4: 全局搜索对话内容
app.get('/api/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query) {
      return res.status(400).json({ error: '缺少搜索关键词' });
    }

    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude.json');

    if (!fs.existsSync(configPath)) {
      return res.json({ success: true, results: [] });
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const projects = config.projects || {};

    const results = [];
    const searchLower = query.toLowerCase();

    // 遍历所有项目
    for (const [projectPath, projectInfo] of Object.entries(projects)) {
      const projectName = path.basename(projectPath) || projectPath;

      // 获取项目的编码目录
      const projectDirs = fs.readdirSync(path.join(homeDir, '.claude', 'projects'), { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      // 尝试匹配项目目录
      const pathParts = projectPath.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      let matchedDir = projectDirs.find(dir => dir.endsWith(lastPart)) ||
                       projectDirs.find(dir => dir.includes(lastPart));

      if (!matchedDir) continue;

      const sessionDir = path.join(homeDir, '.claude', 'projects', matchedDir);
      if (!fs.existsSync(sessionDir)) continue;

      // 读取所有会话文件
      const files = fs.readdirSync(sessionDir)
        .filter(file => file.endsWith('.jsonl') && !file.toLowerCase().includes('settings'));

      // 搜索每个会话
      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const lines = fileContent.trim().split('\n');

          let sessionId = '';
          const messages = [];

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.sessionId && !sessionId) sessionId = data.sessionId;

              if (data.type === 'user' || data.type === 'assistant') {
                messages.push(data);
              } else if (data.message && (data.type === 'user' || data.type === 'assistant')) {
                messages.push({ type: data.type, message: data.message });
              }
            } catch (e) {
              continue;
            }
          }

          // 搜索消息内容
          for (const msg of messages) {
            const content = msg.message?.content || msg.content || '';
            const text = typeof content === 'string' ? content :
                         Array.isArray(content) ? content.filter(c => c.type === 'text').map(c => c.text).join('\n') : '';

            if (text.toLowerCase().includes(searchLower)) {
              // 提取匹配的上下文
              const matchIndex = text.toLowerCase().indexOf(searchLower);
              const contextStart = Math.max(0, matchIndex - 50);
              const contextEnd = Math.min(text.length, matchIndex + query.length + 50);
              const preview = '...' + text.substring(contextStart, contextEnd) + '...';

              results.push({
                sessionId: sessionId || file.replace('.jsonl', ''),
                filePath,
                projectName,
                projectPath,
                role: msg.message?.role || msg.role,
                preview,
                matchIndex
              });
              break; // 每个会话只返回一个匹配结果
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    res.json({
      success: true,
      results: results.slice(0, 50) // 限制最多返回 50 条结果
    });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API 5: 获取统计信息
app.get('/api/stats', (req, res) => {
  try {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude.json');

    if (!fs.existsSync(configPath)) {
      return res.json({ success: true, stats: { totalProjects: 0, totalSessions: 0, projectStats: [], contributionGraph: [] } });
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const projects = config.projects || {};
    const projectStats = [];
    let totalSessions = 0;

    // 生成贡献热力图数据（按日期统计对话数）
    const contributionMap = new Map();

    const projectsBaseDir = path.join(homeDir, '.claude', 'projects');
    const projectDirs = fs.existsSync(projectsBaseDir) ?
      fs.readdirSync(projectsBaseDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name) : [];

    for (const [projectPath, projectInfo] of Object.entries(projects)) {
      const projectName = path.basename(projectPath) || projectPath;
      const pathParts = projectPath.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];

      let matchedDir = projectDirs.find(dir => dir.endsWith(lastPart)) ||
                       projectDirs.find(dir => dir.includes(lastPart));

      if (matchedDir) {
        const sessionDir = path.join(projectsBaseDir, matchedDir);
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir)
            .filter(file => file.endsWith('.jsonl') && !file.toLowerCase().includes('settings'));
          const sessionCount = files.length;
          totalSessions += sessionCount;
          // 使用组件期望的字段名：name 和 count
          projectStats.push({ name: projectName, count: sessionCount, projectPath });

          // 统计每个会话文件的修改日期
          for (const file of files) {
            const filePath = path.join(sessionDir, file);
            const stats = fs.statSync(filePath);
            const dateKey = stats.mtime.toISOString().split('T')[0]; // YYYY-MM-DD
            contributionMap.set(dateKey, (contributionMap.get(dateKey) || 0) + 1);
          }
        }
      }
    }

    projectStats.sort((a, b) => b.sessionCount - a.sessionCount);

    // 收集最近访问的会话（按修改时间排序）
    const recentSessions = [];
    for (const [projectPath, projectInfo] of Object.entries(projects)) {
      const projectName = path.basename(projectPath) || projectPath;
      const pathParts = projectPath.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];

      let matchedDir = projectDirs.find(dir => dir.endsWith(lastPart)) ||
                       projectDirs.find(dir => dir.includes(lastPart));

      if (matchedDir) {
        const sessionDir = path.join(projectsBaseDir, matchedDir);
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir)
            .filter(file => file.endsWith('.jsonl') && !file.toLowerCase().includes('settings'))
            .map(file => {
              const filePath = path.join(sessionDir, file);
              const stats = fs.statSync(filePath);

              // 读取会话文件获取消息数量和简介
              let messageCount = 0;
              let summary = '';

              try {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const lines = fileContent.trim().split('\n');

                for (const line of lines) {
                  try {
                    const data = JSON.parse(line);

                    // 统计消息数量（用户和助手消息）
                    if (data.type === 'user' || data.type === 'assistant') {
                      messageCount++;

                      // 获取第一条用户消息作为简介
                      if (!summary && data.type === 'user') {
                        const msg = data.message || data;
                        const content = msg.content || '';

                        if (typeof content === 'string') {
                          summary = content.substring(0, 100);
                        } else if (Array.isArray(content)) {
                          const textPart = content.find(c => c.type === 'text');
                          if (textPart && textPart.text) {
                            summary = textPart.text.substring(0, 100);
                          }
                        }
                      }
                    } else if (data.message) {
                      const messageType = data.type;
                      if (messageType === 'user' || messageType === 'assistant') {
                        messageCount++;

                        if (!summary && messageType === 'user') {
                          const content = data.message.content || '';
                          if (typeof content === 'string') {
                            summary = content.substring(0, 100);
                          } else if (Array.isArray(content)) {
                            const textPart = content.find(c => c.type === 'text');
                            if (textPart && textPart.text) {
                              summary = textPart.text.substring(0, 100);
                            }
                          }
                        }
                      }
                    }
                  } catch (e) {
                    continue;
                  }
                }

                // 如果没有用户消息，尝试获取助手消息作为简介
                if (!summary && messageCount > 0) {
                  for (const line of lines) {
                    try {
                      const data = JSON.parse(line);
                      const msg = data.message || data;
                      const content = msg.content || '';

                      let textContent = '';
                      if (typeof content === 'string') {
                        textContent = content;
                      } else if (Array.isArray(content)) {
                        const textPart = content.find(c => c.type === 'text');
                        if (textPart && textPart.text) {
                          textContent = textPart.text;
                        }
                      }

                      if (textContent) {
                        summary = textContent.substring(0, 100);
                        break;
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                }
              } catch (e) {
                // 读取失败时使用默认值
                summary = '';
              }

              return {
                sessionId: file.replace('.jsonl', ''),
                filePath,
                projectPath,
                projectName,
                modifiedAt: stats.mtime,
                messageCount,
                summary
              };
            });

          recentSessions.push(...files);
        }
      }
    }

    // 按修改时间排序，取最近 10 个
    recentSessions.sort((a, b) => b.modifiedAt - a.modifiedAt);

    // 转换贡献图为数组并按日期排序
    const contributionGraph = Array.from(contributionMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 只返回最近一年的数据
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const filteredContributionGraph = contributionGraph.filter(
      item => new Date(item.date) >= oneYearAgo
    );

    res.json({
      success: true,
      stats: {
        totalProjects: Object.keys(projects).length,
        totalSessions,
        projectStats: projectStats.slice(0, 10),
        contributionGraph: filteredContributionGraph,
        recentSessions: recentSessions.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API 6: 扫描敏感信息
app.get('/api/security/scan', async (req, res) => {
  try {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude.json');

    if (!fs.existsSync(configPath)) {
      return res.json({ success: true, results: [] });
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const projects = config.projects || {};

    // 敏感信息正则模式
    const sensitivePatterns = [
      { name: 'API Key', pattern: /(?:sk-|api[_-]?key|apikey)[\w-]{20,}/gi, severity: 'high' },
      { name: 'Token', pattern: /(?:token|access[_-]?token|auth[_-]?token)[\s:=]+[a-zA-Z0-9._-]{20,}/gi, severity: 'high' },
      { name: 'Password', pattern: /(?:password|passwd|pwd)[\s:=]+[^\s]{4,}/gi, severity: 'medium' },
      { name: 'Email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: 'low' },
      { name: 'IP Address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, severity: 'low' },
      { name: 'JWT', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, severity: 'high' }
    ];

    const results = [];
    const projectsBaseDir = path.join(homeDir, '.claude', 'projects');
    const projectDirs = fs.existsSync(projectsBaseDir) ?
      fs.readdirSync(projectsBaseDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name) : [];

    for (const [projectPath, projectInfo] of Object.entries(projects)) {
      const projectName = path.basename(projectPath) || projectPath;
      const pathParts = projectPath.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];

      let matchedDir = projectDirs.find(dir => dir.endsWith(lastPart)) ||
                       projectDirs.find(dir => dir.includes(lastPart));

      if (!matchedDir) continue;

      const sessionDir = path.join(projectsBaseDir, matchedDir);
      if (!fs.existsSync(sessionDir)) continue;

      const files = fs.readdirSync(sessionDir)
        .filter(file => file.endsWith('.jsonl') && !file.toLowerCase().includes('settings'));

      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');

          for (const pattern of sensitivePatterns) {
            const matches = fileContent.match(pattern.pattern);
            if (matches) {
              // 去重
              const uniqueMatches = [...new Set(matches.map(m => m.substring(0, 50)))];
              for (const match of uniqueMatches) {
                results.push({
                  type: pattern.name,
                  severity: pattern.severity,
                  content: match,
                  fileName: file,
                  projectName,
                  projectPath
                });
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    // 按严重程度排序
    const severityOrder = { high: 0, medium: 1, low: 2 };
    results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({
      success: true,
      results: results.slice(0, 100), // 限制返回数量
      total: results.length
    });
  } catch (error) {
    console.error('扫描敏感信息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`可用的 API 端点:`);
  console.log(`  - GET /api/projects`);
  console.log(`  - GET /api/sessions?path=<项目路径>`);
  console.log(`  - GET /api/session-detail?filePath=<会话文件路径>`);
});
