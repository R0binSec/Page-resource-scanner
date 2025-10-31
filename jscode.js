javascript:(async () => {
    // 扫描功能
    async function fetchResource(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTP " + response.status);
            return await response.text();
        } catch (error) {
            console.error("[!] Fetch error for " + url + ":", error);
            return null;
        }
    }

    function isValidPath(path) {
        // 排除协议相对URL（以双斜杠开头）和包含协议头的绝对URL
        if (path.startsWith("//") || path.includes("://")) {
            return false;
        }
        return (path.startsWith("/") || path.startsWith("./") || path.startsWith("../")) &&
            !path.includes(" ") &&
            !/[^\x20-\x7E]/.test(path) &&
            path.length > 1 &&
            path.length < 200;
    }

    function extractPaths(content) {
        const regex = /['"]((?:\/|\.\.\/|\.\/)[^'"]+)['"]/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1]);
        }
        return matches.filter(isValidPath);
    }

    // 提取URL路径和参数
    function extractURLs() {
        const urls = new Set();
        
        // 获取当前页面URL
        const currentUrl = window.location.href;
        urls.add(currentUrl);
        
        // 获取页面中的所有链接
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            try {
                const href = link.getAttribute('href');
                if (href && href.startsWith('http')) {
                    urls.add(href);
                } else if (href && href.startsWith('/')) {
                    const fullUrl = new URL(href, window.location.origin).href;
                    urls.add(fullUrl);
                }
            } catch (e) {
                // 忽略无效URL
            }
        });
        
        // 获取脚本和链接资源中的URL
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src) urls.add(src);
        });
        
        const linksCss = document.querySelectorAll('link[href]');
        linksCss.forEach(link => {
            const href = link.getAttribute('href');
            if (href) urls.add(href);
        });
        
        // 获取图片资源URL
        const images = document.querySelectorAll('img[src]');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src) urls.add(src);
        });
        
        // 获取表单action URL
        const forms = document.querySelectorAll('form[action]');
        forms.forEach(form => {
            const action = form.getAttribute('action');
            if (action) {
                try {
                    const fullUrl = new URL(action, window.location.origin).href;
                    urls.add(fullUrl);
                } catch (e) {
                    // 忽略无效URL
                }
            }
        });
        
        return Array.from(urls);
    }
    
    // 从URL中提取路径和参数
    function parseURLs(urls) {
        const paths = new Set();
        const params = new Set();
        const domains = new Set();
        
        urls.forEach(url => {
            try {
                const urlObj = new URL(url);
                
                // 提取域名
                domains.add(urlObj.hostname);
                
                // 提取路径
                const path = urlObj.pathname;
                if (path && path !== '/') {
                    paths.add(path);
                }
                
                // 提取参数
                urlObj.searchParams.forEach((value, key) => {
                    params.add(`${key}=${value}`);
                });
            } catch (e) {
                // 忽略无效URL
            }
        });
        
        return {
            paths: Array.from(paths),
            params: Array.from(params),
            domains: Array.from(domains)
        };
    }

    // 分类路径函数 - 使用更通用的API路径识别
    function categorizePaths(paths) {
        const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.txt', '.json', '.xml', '.zip', '.rar', '.7z', '.tar', '.gz'];
        
        // 新的API路径识别逻辑 - 基于路径模式而不是特定关键词
        const apiPatterns = [
            // 包含路径参数的格式，如 /user/123/, /product/abc/
            /\/[^/]+\/[^/]+\/?$/,
            // 包含多个路径段的格式，如 /api/user/profile
            /\/[^/]+\/[^/]+\/[^/]+/,
            // 包含常见RESTful模式的格式
            /\/[^/]+\/[^/]+\.(json|xml|html?)$/i
        ];
        
        const staticPaths = [];
        const apiPaths = [];
        const otherPaths = [];
        
        paths.forEach(path => {
            const lowerPath = path.toLowerCase();
            const isStatic = staticExtensions.some(ext => lowerPath.includes(ext));
            const isApi = apiPatterns.some(pattern => pattern.test(path));
            
            if (isStatic) {
                staticPaths.push(path);
            } else if (isApi) {
                apiPaths.push(path);
            } else {
                otherPaths.push(path);
            }
        });
        
        return { staticPaths, apiPaths, otherPaths };
    }

    const uniquePaths = new Set();
    const scannedResources = new Set();

    async function scanResource(url) {
        if (scannedResources.has(url)) return;
        scannedResources.add(url);
        console.log("📡 Fetching: " + url);
        
        const content = await fetchResource(url);
        if (!content) return;
        
        const paths = extractPaths(content);
        paths.forEach(path => uniquePaths.add(path));
    }

    const resources = performance.getEntriesByType("resource").map(resource => resource.name);
    console.log("📊 " + resources.length + " resources found.");
    
    // 提取URL信息
    console.log("🔗 Extracting URLs from page...");
    const pageUrls = extractURLs();
    const { paths: urlPaths, params: urlParams, domains: urlDomains } = parseURLs(pageUrls);
    
    // 创建扫描进度窗口
    const features = "width=600,height=400,resizable=yes,scrollbars=yes,status=no,location=no";
    const progressWindow = window.open("", "ScanProgress", features);
    
    if (!progressWindow) {
        console.log("扫描进度窗口被阻止，将继续在后台扫描");
    } else {
        // 设置扫描进度窗口内容
        progressWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>扫描中... | NullSecurityX</title>
                <style>
                    body { font-family: 'Monaco', 'Consolas', 'Courier New', monospace; margin: 0; padding: 0; background: #2c3e50; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; }
                    .container { text-align: center; padding: 30px; background: #34495e; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); max-width: 500px; width: 90%; }
                    h1 { margin-bottom: 20px; font-size: 24px; }
                    .progress-container { width: 100%; background: #2c3e50; border-radius: 5px; margin: 20px 0; }
                    .progress-bar { width: 0%; height: 20px; background: #3498db; border-radius: 5px; transition: width 0.3s; }
                    .status { margin: 15px 0; font-size: 14px; min-height: 40px; }
                    .spinner { border: 4px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 4px solid #3498db; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔍 路径扫描中...</h1>
                    <div class="spinner"></div>
                    <div class="status" id="status">正在初始化扫描...</div>
                    <div class="progress-container">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>
                    <div id="progressText">0%</div>
                </div>
            </body>
            </html>
        `);
        progressWindow.document.close();
    }
    
    // 扫描所有资源，并更新进度
    for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const progress = Math.round(((i + 1) / resources.length) * 100);
        
        // 更新进度窗口
        if (progressWindow && !progressWindow.closed) {
            progressWindow.document.getElementById('status').textContent = 
                `正在扫描资源 ${i+1}/${resources.length}: ${resource.substring(0, 50)}${resource.length > 50 ? '...' : ''}`;
            progressWindow.document.getElementById('progressBar').style.width = progress + '%';
            progressWindow.document.getElementById('progressText').textContent = progress + '%';
        }
        
        await scanResource(resource);
    }
    
    const pathsArray = Array.from(uniquePaths);
    console.log("✅ Unique Paths:", pathsArray);
    
    // 分类路径
    const { staticPaths, apiPaths, otherPaths } = categorizePaths(pathsArray);
    
    // 关闭进度窗口
    if (progressWindow && !progressWindow.closed) {
        progressWindow.close();
    }
    
    // 创建结果窗口
    const resultFeatures = "width=1100,height=750,resizable=yes,scrollbars=yes,status=no,location=no";
    const newWindow = window.open("", "PathScanner", resultFeatures);
    
    if (!newWindow) {
        // 如果弹出窗口被阻止，显示备用界面
        showFallbackResults(pathsArray, staticPaths, apiPaths, otherPaths, urlPaths, urlParams, urlDomains, resources.length, pageUrls.length);
        return;
    }
    
    // 设置新窗口内容
    newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>路径扫描结果 | NullSecurityX</title>
            <style>
                body { font-family: 'Monaco', 'Consolas', 'Courier New', monospace; margin: 0; padding: 20px; background: #f5f5f5; color: #333; }
                .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
                .header { background: #2c3e50; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
                .stats { background: #ecf0f1; padding: 15px 20px; border-bottom: 1px solid #bdc3c7; font-size: 14px; }
                .controls { padding: 15px 20px; background: #34495e; display: flex; gap: 10px; flex-wrap: wrap; }
                button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.3s; }
                .copy-btn { background: #3498db; color: white; } .copy-btn:hover { background: #2980b9; } .copy-btn.success { background: #27ae60; }
                .export-btn { background: #9b59b6; color: white; } .export-btn:hover { background: #8e44ad; }
                .close-btn { background: #e74c3c; color: white; } .close-btn:hover { background: #c0392b; }
                .tab-container { background: #f8f9fa; border-bottom: 1px solid #ddd; }
                .tabs { display: flex; margin: 0; padding: 0; list-style: none; overflow-x: auto; }
                .tab { padding: 12px 20px; cursor: pointer; border-right: 1px solid #ddd; background: #ecf0f1; color: #7f8c8d; white-space: nowrap; }
                .tab.active { background: white; color: #2c3e50; font-weight: bold; border-bottom: 2px solid #3498db; }
                .tab:hover:not(.active) { background: #dfe6e9; }
                .tab-content { display: none; padding: 0; }
                .tab-content.active { display: block; }
                .paths-container { max-height: 400px; overflow-y: auto; padding: 0; }
                .path-list { list-style: none; padding: 0; margin: 0; }
                .path-item { padding: 10px 20px; border-bottom: 1px solid #ecf0f1; word-break: break-all; font-size: 13px; line-height: 1.4; }
                .path-item:hover { background: #f8f9fa; }
                .path-item:nth-child(even) { background: #fafafa; } .path-item:nth-child(even):hover { background: #f0f0f0; }
                .empty-state, .loading { padding: 40px 20px; text-align: center; color: #7f8c8d; }
                .category-stats { padding: 10px 20px; background: #f1f2f6; border-bottom: 1px solid #ddd; font-size: 13px; }
                .api-path { color: #e74c3c; }
                .static-path { color: #3498db; }
                .other-path { color: #2c3e50; }
                .url-path { color: #27ae60; }
                .url-param { color: #e67e22; }
                .url-domain { color: #9b59b6; }
                .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; padding: 15px 20px; }
                .info-card { background: #f8f9fa; border-radius: 5px; padding: 15px; border-left: 4px solid #3498db; }
                .info-card h3 { margin-top: 0; color: #2c3e50; }
                .info-card ul { margin: 0; padding-left: 20px; }
                .info-card li { margin-bottom: 5px; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔍 路径扫描结果</h1>
                    <span style="font-size: 14px; opacity: 0.9;">NullSecurityX</span>
                </div>
                <div class="stats" id="stats">
                    📊 扫描资源: <strong id="resourcesCount">${resources.length}</strong> 个 | 
                    🌐 页面URL: <strong id="urlsCount">${pageUrls.length}</strong> 个 |
                    ✅ 找到路径: <strong id="pathsCount">${pathsArray.length}</strong> 条 | 
                    🕒 扫描时间: <span id="scanTime">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="controls">
                    <button class="copy-btn" id="copyAllBtn">📋 复制全部路径</button>
                    <button class="copy-btn" id="copyCurrentBtn">📋 复制当前标签页</button>
                    <button class="export-btn" id="exportAllBtn">💾 导出全部为文本</button>
                    <button class="export-btn" id="exportCurrentBtn">💾 导出当前标签页</button>
                    <button class="close-btn" id="closeBtn">❌ 关闭窗口</button>
                </div>
                <div class="tab-container">
                    <ul class="tabs">
                        <li class="tab active" data-tab="all">相对路径 (${pathsArray.length})</li>
                        <li class="tab" data-tab="static">静态文件 (${staticPaths.length})</li>
                        <li class="tab" data-tab="api">API接口 (${apiPaths.length})</li>
                        <li class="tab" data-tab="other">其他路径 (${otherPaths.length})</li>
                        <li class="tab" data-tab="urls">URL信息 (${pageUrls.length})</li>
                        <li class="tab" data-tab="summary">扫描摘要</li>
                    </ul>
                </div>
                <div id="tabContents">
                    <div class="tab-content active" id="tab-all">
                        <div class="category-stats">📁 相对路径 - 共 ${pathsArray.length} 条</div>
                        <div class="paths-container">
                            ${pathsArray.length > 0 ? 
                                `<ul class="path-list">${pathsArray.map(path => {
                                    const lowerPath = path.toLowerCase();
                                    const isStatic = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.txt', '.json', '.xml'].some(ext => lowerPath.includes(ext));
                                    // 使用新的API识别逻辑
                                    const apiPatterns = [
                                        /\/[^/]+\/[^/]+\/?$/,
                                        /\/[^/]+\/[^/]+\/[^/]+/,
                                        /\/[^/]+\/[^/]+\.(json|xml|html?)$/i
                                    ];
                                    const isApi = apiPatterns.some(pattern => pattern.test(path));
                                    const className = isApi ? 'api-path' : (isStatic ? 'static-path' : 'other-path');
                                    return `<li class="path-item ${className}">${escapeHtml(path)}</li>`;
                                }).join('')}</ul>` :
                                `<div class="empty-state"><h3>🔍 未找到相对路径</h3><p>在扫描的资源文件中未发现有效的相对路径</p></div>`
                            }
                        </div>
                    </div>
                    <div class="tab-content" id="tab-static">
                        <div class="category-stats">🖼️ 静态文件路径 - 共 ${staticPaths.length} 条 (JS、CSS、图片、字体等)</div>
                        <div class="paths-container">
                            ${staticPaths.length > 0 ? 
                                `<ul class="path-list">${staticPaths.map(path => `<li class="path-item static-path">${escapeHtml(path)}</li>`).join('')}</ul>` :
                                `<div class="empty-state"><h3>📁 未找到静态文件路径</h3><p>未发现JS、CSS、图片等静态文件路径</p></div>`
                            }
                        </div>
                    </div>
                    <div class="tab-content" id="tab-api">
                        <div class="category-stats">🔌 API接口路径 - 共 ${apiPaths.length} 条 (基于路径模式识别，如 /xx/ 格式)</div>
                        <div class="paths-container">
                            ${apiPaths.length > 0 ? 
                                `<ul class="path-list">${apiPaths.map(path => `<li class="path-item api-path">${escapeHtml(path)}</li>`).join('')}</ul>` :
                                `<div class="empty-state"><h3>🔌 未找到API接口路径</h3><p>未发现符合API路径模式的路径</p></div>`
                            }
                        </div>
                    </div>
                    <div class="tab-content" id="tab-other">
                        <div class="category-stats">🔗 其他路径 - 共 ${otherPaths.length} 条 (路由、配置文件等)</div>
                        <div class="paths-container">
                            ${otherPaths.length > 0 ? 
                                `<ul class="path-list">${otherPaths.map(path => `<li class="path-item other-path">${escapeHtml(path)}</li>`).join('')}</ul>` :
                                `<div class="empty-state"><h3>🔗 未找到其他路径</h3><p>未发现路由、配置文件等其他类型路径</p></div>`
                            }
                        </div>
                    </div>
                    <div class="tab-content" id="tab-urls">
                        <div class="category-stats">🌐 URL信息 - 共发现 ${pageUrls.length} 个URL</div>
                        <div class="info-grid">
                            <div class="info-card">
                                <h3>🔗 完整URL列表 (${pageUrls.length})</h3>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    <ul>
                                        ${pageUrls.slice(0, 50).map(url => `<li class="url-path">${escapeHtml(url)}</li>`).join('')}
                                        ${pageUrls.length > 50 ? `<li>... 还有 ${pageUrls.length - 50} 个URL</li>` : ''}
                                    </ul>
                                </div>
                            </div>
                            <div class="info-card">
                                <h3>📁 URL路径 (${urlPaths.length})</h3>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    <ul>
                                        ${urlPaths.slice(0, 30).map(path => `<li class="url-path">${escapeHtml(path)}</li>`).join('')}
                                        ${urlPaths.length > 30 ? `<li>... 还有 ${urlPaths.length - 30} 个路径</li>` : ''}
                                    </ul>
                                </div>
                            </div>
                            <div class="info-card">
                                <h3>🔍 URL参数 (${urlParams.length})</h3>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    <ul>
                                        ${urlParams.slice(0, 30).map(param => `<li class="url-param">${escapeHtml(param)}</li>`).join('')}
                                        ${urlParams.length > 30 ? `<li>... 还有 ${urlParams.length - 30} 个参数</li>` : ''}
                                    </ul>
                                </div>
                            </div>
                            <div class="info-card">
                                <h3>🌍 域名 (${urlDomains.length})</h3>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    <ul>
                                        ${urlDomains.map(domain => `<li class="url-domain">${escapeHtml(domain)}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tab-content" id="tab-summary">
                        <div class="category-stats">📊 扫描摘要</div>
                        <div class="info-grid">
                            <div class="info-card">
                                <h3>📈 统计概览</h3>
                                <ul>
                                    <li>扫描资源文件: <strong>${resources.length}</strong> 个</li>
                                    <li>发现页面URL: <strong>${pageUrls.length}</strong> 个</li>
                                    <li>提取相对路径: <strong>${pathsArray.length}</strong> 条</li>
                                    <li>静态文件路径: <strong>${staticPaths.length}</strong> 条</li>
                                    <li>API接口路径: <strong>${apiPaths.length}</strong> 条</li>
                                    <li>其他路径: <strong>${otherPaths.length}</strong> 条</li>
                                    <li>URL路径: <strong>${urlPaths.length}</strong> 条</li>
                                    <li>URL参数: <strong>${urlParams.length}</strong> 个</li>
                                    <li>域名: <strong>${urlDomains.length}</strong> 个</li>
                                </ul>
                            </div>
                            <div class="info-card">
                                <h3>🔗 当前页面信息</h3>
                                <ul>
                                    <li>URL: <span class="url-path">${escapeHtml(window.location.href)}</span></li>
                                    <li>域名: <span class="url-domain">${escapeHtml(window.location.hostname)}</span></li>
                                    <li>路径: <span class="url-path">${escapeHtml(window.location.pathname)}</span></li>
                                    <li>参数: <span class="url-param">${escapeHtml(window.location.search)}</span></li>
                                </ul>
                            </div>
                            <div class="info-card">
                                <h3>📋 快速操作</h3>
                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    <button onclick="copyAllURLs()" style="padding: 8px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">复制所有URL</button>
                                    <button onclick="exportAllURLs()" style="padding: 8px; background: #9b59b6; color: white; border: none; border-radius: 4px; cursor: pointer;">导出所有URL</button>
                                    <button onclick="copyAllPaths()" style="padding: 8px; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer;">复制所有路径</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                // 为摘要页面的按钮添加功能
                function copyAllURLs() {
                    const urlsText = ${JSON.stringify(pageUrls)}.join('\\n');
                    copyToClipboard(urlsText, "所有URL");
                }
                
                function exportAllURLs() {
                    const urlsText = ${JSON.stringify(pageUrls)}.join('\\n');
                    const blob = new Blob([urlsText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'urls_' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                }
                
                function copyAllPaths() {
                    const pathsText = ${JSON.stringify(pathsArray)}.join('\\n');
                    copyToClipboard(pathsText, "所有路径");
                }
                
                function copyToClipboard(text, type) {
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(text).then(() => {
                            alert('✅ ' + type + '复制成功!');
                        }).catch(err => {
                            alert('复制失败: ' + err);
                        });
                    } else {
                        // 降级方案
                        const textArea = document.createElement("textarea");
                        textArea.value = text;
                        textArea.style.position = "fixed";
                        textArea.style.left = "-999999px";
                        textArea.style.top = "-999999px";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        
                        try {
                            const successful = document.execCommand('copy');
                            if (successful) {
                                alert('✅ ' + type + '复制成功!');
                            } else {
                                alert("复制失败，请手动选择文本复制");
                            }
                        } catch (err) {
                            alert("复制失败，请手动选择文本复制");
                        }
                        
                        document.body.removeChild(textArea);
                    }
                }
            </script>
        </body>
        </html>
    `);
    
    newWindow.document.close();
    
    // 现在添加事件监听器
    const allPaths = pathsArray;
    let currentActiveTab = 'all';
    
    // 选项卡切换功能
    newWindow.document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // 更新活动选项卡
            newWindow.document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            newWindow.document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            newWindow.document.getElementById(`tab-${tabName}`).classList.add('active');
            
            currentActiveTab = tabName;
        });
    });
    
    // 获取当前活动标签页的路径
    function getCurrentPaths() {
        switch(currentActiveTab) {
            case 'static': return staticPaths;
            case 'api': return apiPaths;
            case 'other': return otherPaths;
            case 'urls': return pageUrls; // 返回URL列表
            default: return allPaths;
        }
    }
    
    // 复制当前标签页功能
    newWindow.document.getElementById('copyCurrentBtn').addEventListener('click', function() {
        const currentPaths = getCurrentPaths();
        if (currentPaths.length === 0) {
            alert("当前标签页没有找到任何内容可复制");
            return;
        }
        
        const pathsText = currentPaths.join('\n');
        const btn = newWindow.document.getElementById('copyCurrentBtn');
        copyToClipboard(newWindow, pathsText, btn, "当前标签页");
    });
    
    // 复制全部路径功能
    newWindow.document.getElementById('copyAllBtn').addEventListener('click', function() {
        if (allPaths.length === 0) {
            alert("没有找到任何路径可复制");
            return;
        }
        
        const pathsText = allPaths.join('\n');
        const btn = newWindow.document.getElementById('copyAllBtn');
        copyToClipboard(newWindow, pathsText, btn, "全部");
    });
    
    // 导出当前标签页功能
    newWindow.document.getElementById('exportCurrentBtn').addEventListener('click', function() {
        const currentPaths = getCurrentPaths();
        if (currentPaths.length === 0) {
            alert("当前标签页没有找到任何内容可导出");
            return;
        }
        
        const tabNames = { 
            all: '全部', 
            static: '静态文件', 
            api: 'API接口', 
            other: '其他路径',
            urls: 'URL列表',
            summary: '摘要'
        };
        const pathsText = currentPaths.join('\n');
        const blob = new Blob([pathsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = newWindow.document.createElement('a');
        a.href = url;
        a.download = `paths_${tabNames[currentActiveTab]}_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // 导出全部路径功能
    newWindow.document.getElementById('exportAllBtn').addEventListener('click', function() {
        if (allPaths.length === 0) {
            alert("没有找到任何路径可导出");
            return;
        }
        
        const pathsText = allPaths.join('\n');
        const blob = new Blob([pathsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = newWindow.document.createElement('a');
        a.href = url;
        a.download = 'paths_all_' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // 关闭功能
    newWindow.document.getElementById('closeBtn').addEventListener('click', function() {
        newWindow.close();
    });
    
    newWindow.focus();
    
    // 统一的复制到剪贴板函数
    function copyToClipboard(win, text, button, tabName = "") {
        // 使用现代剪贴板API
        if (navigator.clipboard && win.navigator.clipboard.writeText) {
            win.navigator.clipboard.writeText(text).then(() => {
                const originalText = button.textContent;
                button.textContent = `✅ ${tabName}复制成功!`;
                button.classList.add('success');
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('success');
                }, 2000);
            }).catch(err => {
                // 降级方案
                copyUsingFallback(win, text, button, tabName);
            });
        } else {
            // 降级方案
            copyUsingFallback(win, text, button, tabName);
        }
    }
    
    // 降级复制方案
    function copyUsingFallback(win, text, button, tabName = "") {
        const textArea = win.document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        win.document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = win.document.execCommand('copy');
            if (successful) {
                const originalText = button.textContent;
                button.textContent = `✅ ${tabName}复制成功!`;
                button.classList.add('success');
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('success');
                }, 2000);
            } else {
                alert("复制失败，请手动选择文本复制");
            }
        } catch (fallbackErr) {
            alert("复制失败，请手动选择文本复制");
        }
        
        win.document.body.removeChild(textArea);
    }
    
    // 辅助函数：转义HTML
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // 更新备用显示函数
    function showFallbackResults(allPaths, staticPaths, apiPaths, otherPaths, urlPaths, urlParams, urlDomains, resourcesCount, urlsCount) {
        // 由于代码长度限制，这里省略了备用界面的详细实现
        // 实际使用时应该实现一个完整的备用界面
        alert("扫描完成！但弹出窗口被阻止。\n找到路径: " + allPaths.length + " 条\n页面URL: " + urlsCount + " 个");
        console.log("相对路径:", allPaths);
        console.log("页面URL:", urlPaths);
        console.log("URL参数:", urlParams);
        console.log("域名:", urlDomains);
    }
})();