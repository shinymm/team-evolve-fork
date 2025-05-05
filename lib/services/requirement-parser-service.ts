import { Scene } from '@/types/requirement'

interface MarkdownSection {
  title: string;
  content: string;
  subSections: MarkdownSubSection[];
  level: number;
}

interface MarkdownSubSection {
  title: string;
  content: string;
  level: number;
}

interface DocumentStructure {
  sections: MarkdownSection[];
}

export interface RequirementParseResult {
  contentBeforeScenes: string; // 需求详述章节之前的内容
  scenes: Scene[];             // 从需求详述章节提取的场景列表
  contentAfterScenes: string;  // 需求详述章节之后的内容
}

export class RequirementParserService {
  /**
   * 解析需求书 Markdown 内容
   * @param mdContent Markdown 格式的需求书内容
   * @returns 解析后的需求书对象
   */
  public parseRequirement(mdContent: string): RequirementParseResult {
    console.log('开始解析需求书内容，长度:', mdContent.length);
    
    const documentStructure = this.parseMarkdownStructure(mdContent);
    
    let scenes: Scene[] = [];
    let contentBeforeScenes = '';
    let contentAfterScenes = '';
    
    // 1. 查找"需求详述"章节的索引
    const detailSectionIndex = documentStructure.sections.findIndex(section =>
      section.title.includes('需求详述')
    );
    
    if (detailSectionIndex !== -1) {
      console.log(`找到"需求详述"章节，索引: ${detailSectionIndex}, 标题: ${documentStructure.sections[detailSectionIndex].title}`);
      const detailSection = documentStructure.sections[detailSectionIndex];
      
      // 2. 提取场景列表 (调用重构后的 extractScenes)
      scenes = this.extractScenes(detailSection);
      
      // 3. 拼接"需求详述"之前章节的内容
      contentBeforeScenes = documentStructure.sections
        .slice(0, detailSectionIndex)
        .map(section => `## ${section.title}\n${section.content}`)
        .join('\n\n'); // Join sections with double newline
      
      // 4. 拼接"需求详述"之后章节的内容
      contentAfterScenes = documentStructure.sections
        .slice(detailSectionIndex + 1)
        .map(section => `## ${section.title}\n${section.content}`)
        .join('\n\n'); // Join sections with double newline
    } else {
      console.warn('未找到"需求详述"章节，无法按预期提取场景。将尝试把整个文档作为前置内容处理。');
      // 如果没有找到，将所有章节内容视为场景前内容
      documentStructure.sections.forEach(section => {
        contentBeforeScenes += `## ${section.title}\n${section.content}\n\n`;
      });
    }
    
    // 清理末尾多余的换行符
    contentBeforeScenes = contentBeforeScenes.trim();
    contentAfterScenes = contentAfterScenes.trim();
    
    const result: RequirementParseResult = {
      contentBeforeScenes,
      scenes,
      contentAfterScenes
    };
    
    // --- 添加详细日志 --- 
    console.log('--- Final Parse Result ---');
    console.log('Content Before Scenes:\n', contentBeforeScenes);
    console.log('---');
    console.log(`Scenes (${scenes.length}):`);
    scenes.forEach((scene, i) => {
        console.log(`  Scene ${i+1}: ${scene.name}`);
        console.log(`  Content:\n`, scene.content); // Log full scene content
        console.log('  ---');
    });
    console.log('Content After Scenes:\n', contentAfterScenes);
    console.log('--------------------------');
    // --- 日志结束 ---
    
    console.log('解析结果:', {
      找到需求详述: detailSectionIndex !== -1,
      场景数: scenes.length,
      场景名称: scenes.map(s => s.name),
      场景前内容长度: contentBeforeScenes.length,
      场景后内容长度: contentAfterScenes.length
    });
    
    // 保存结构化结果到 localStorage (可选)
    try {
      localStorage.setItem('requirement-structured-content', JSON.stringify(result));
    } catch (error) {
      console.error('无法将结构化需求保存到 localStorage:', error);
    }
    
    return result;
  }
  
  /**
   * 解析Markdown文档结构，提取所有章节及其层次关系
   */
  private parseMarkdownStructure(mdContent: string): DocumentStructure {
    console.log('[Parser] Starting parseMarkdownStructure');
    console.log('[Parser] Input content length:', mdContent.length);
    
    // 规范化换行符，确保所有换行符都是 \n
    const normalizedContent = mdContent.replace(/\r\n/g, '\n');
    
    // 预处理：只移除文档最顶部的 H1 标题（如果有）
    const documentBody = normalizedContent.replace(/^#\s+[^\n]+\n?/, '');
    console.log('[Parser] Document body after H1 removal (first 100 chars):', 
                documentBody.substring(0, 100).replace(/\n/g, '\\n')); // 转义换行符以便查看
    
    // 输出整个文档内容中的 ### 标记数量，帮助诊断
    const h3Count = (documentBody.match(/###\s+/g) || []).length;
    console.log(`[Parser] Document contains ${h3Count} occurrences of ###`);

    const mainSections: MarkdownSection[] = [];
    
    // 更简单的方法：先按 ## 标题分割整个文档
    const sections = documentBody.split(/\n##\s+/);
    console.log(`[Parser] Split document into ${sections.length} sections based on ## headers`);
    
    // 第一个元素是文档开头到第一个 ## 之前的内容，通常可以忽略
    if (sections.length > 0 && sections[0].trim()) {
      console.log('[Parser] Document has content before first ##:', sections[0].substring(0, 50));
    }
    
    // 处理除第一个外的所有章节（每个都以 ## 标题开头）
    for (let i = 1; i < sections.length; i++) {
      const sectionContent = sections[i];
      // 查找章节标题（第一行）和余下内容
      const titleMatch = sectionContent.match(/^([^\n]+)(?:\n([\s\S]*))?$/);
      
      if (titleMatch) {
        const title = titleMatch[1].trim();
        // 如果匹配了内容部分，使用它；否则为空字符串
        const bodyContent = titleMatch[2] ? titleMatch[2].trim() : '';
        
        console.log(`[Parser] Processing section ${i}: "${title}"`);
        console.log(`[Parser] Section body length: ${bodyContent.length} characters`);
        if (bodyContent.length > 0) {
          console.log(`[Parser] Section body start: "${bodyContent.substring(0, Math.min(50, bodyContent.length))}..."`);
        }
        
        // --- 针对需求详述章节的特殊调试 ---
        if (title.includes('需求详述')) {
          console.log(`[Debug] Detailed analysis for section: ${title}`);
          console.log(`[Debug] Full section body length: ${bodyContent.length}`);
          console.log(`[Debug] Full section body:\n--START--\n${bodyContent}\n--END--`);
          console.log(`[Debug] First 200 chars with newlines shown: "${bodyContent.substring(0, 200).replace(/\n/g, '\\n')}"`);
          
          // 检查该章节中 ### 标记的数量
          const subHeaderCount = (bodyContent.match(/###\s+/g) || []).length;
          console.log(`[Debug] Section contains ${subHeaderCount} occurrences of ###`);
          
          // 提取该章节中所有的 ### 行，直接输出
          const subHeaderLines = bodyContent.match(/###\s+[^\n]+/g) || [];
          if (subHeaderLines.length > 0) {
            console.log('[Debug] ### lines found in this section:');
            subHeaderLines.forEach((line, i) => {
              console.log(`[Debug]   ${i+1}. ${line}`);
            });
          } else {
            console.log('[Debug] No ### lines found in this section!');
          }
        }
        // --- 调试结束 ---

        const subSections: MarkdownSubSection[] = [];
        
        // 使用更直接的方法提取 ### 子章节内容
        if (bodyContent) {
          // 使用正则表达式直接查找所有的 ### 子章节
          // 匹配整个文档中所有以 ### 开头的段落及其后续内容
          const subSectionRegex = /(?:^|\n)###\s+([^\n]+)(?:\n([\s\S]*?))?(?=\n###\s+|$)/g;
          let match;
          let matchCount = 0;
          
          // 对需求详述章节做更详细的日志
          if (title.includes('需求详述')) {
            console.log(`[Debug] 使用直接的正则表达式匹配查找子章节`);
            console.log(`[Debug] 章节内容开头50个字符: "${bodyContent.substring(0, 50).replace(/\n/g, '\\n')}"`);
          }
          
          // 重置正则表达式
          subSectionRegex.lastIndex = 0;
          
          // 搜索所有匹配
          while ((match = subSectionRegex.exec(bodyContent)) !== null) {
            matchCount++;
            const subTitle = match[1].trim();
            const subBody = match[2] ? match[2].trim() : '';
            
            // 针对需求详述章节的调试
            if (title.includes('需求详述')) {
              console.log(`[Debug] 正则匹配到子章节 ${matchCount}: "${subTitle}"`);
              if (subBody.length > 0) {
                console.log(`[Debug] 子章节内容开头: "${subBody.substring(0, Math.min(50, subBody.length)).replace(/\n/g, '\\n')}..."`);
              }
            }
            
            subSections.push({
              title: subTitle,
              content: `### ${subTitle}\n${subBody}`,
              level: 3
            });
          }
          
          if (title.includes('需求详述')) {
            console.log(`[Debug] 通过正则表达式共找到 ${matchCount} 个子章节`);
          }
        }
        
        // --- 子章节提取结果调试 ---
        if (title.includes('需求详述')) {
          console.log(`[Debug] Finished parsing subSections for ${title}. Found ${subSections.length} subSections.`);
          for (const sub of subSections) {
            console.log(`[Debug] - SubSection: ${sub.title}`);
          }
        }
        // --- 调试结束 ---

        mainSections.push({
          title,
          content: bodyContent,
          subSections,
          level: 2
        });
      }
    }
    
    console.log(`[Parser] Finished processing sections. Found ${mainSections.length} sections.`);
    
    // 输出所有找到的章节名称和子章节数量
    mainSections.forEach((section, i) => {
      console.log(`[Parser] Section ${i+1}: ${section.title} (${section.subSections.length} subSections)`);
    });

    return {
      sections: mainSections
    };
  }
  
  /**
   * 从指定的"需求详述"章节中提取场景列表
   * @param detailSection 代表"需求详述"的 MarkdownSection 对象
   * @returns 从该章节提取的 Scene 数组
   */
  private extractScenes(detailSection: MarkdownSection): Scene[] {
    const scenes: Scene[] = [];
    const ignoreTitles = ['场景概述', '用户旅程']; // 在章节级别忽略这些标题

    if (!detailSection) {
      console.warn('extractScenes 传入了无效的 detailSection');
      return scenes;
    }

    console.log(`开始从章节 "${detailSection.title}" 提取场景...`);
    console.log(`章节内容包含 ${detailSection.subSections.length} 个子章节`);

    if (detailSection.subSections && detailSection.subSections.length > 0) {
      // 对子章节按标题进行排序和分组
      // 场景通常以序号开头，如"1. 场景1"或"场景1："
      const sceneSubSections: MarkdownSubSection[] = [];
      
      // 首先，寻找所有可能是场景的子章节
      for (const subSection of detailSection.subSections) {
        const title = subSection.title;
        console.log(`检查子章节标题: "${title}"`);
        
        // 检查是否是被忽略的标题
        if (ignoreTitles.some(keyword => title.toLowerCase().includes(keyword.toLowerCase()))) {
          console.log(`忽略子章节: "${title}" (包含忽略关键词)`);
          continue;
        }

        // 检查是否是场景标题（包含"场景"关键词或者符合序号格式）
        const isSceneTitle = 
          title.includes('场景') || 
          title.toLowerCase().includes('scene') ||
          /^\d+\.\s+.+/.test(title) || // 匹配"1. 标题"格式
          /^\[\d+\]/.test(title);      // 匹配"[1]标题"格式
        
        if (isSceneTitle) {
          console.log(`识别为场景标题: "${title}"`);
          sceneSubSections.push(subSection);
        } else {
          console.log(`不确定是否为场景标题，仍然包含: "${title}"`);
          sceneSubSections.push(subSection);
        }
      }
      
      console.log(`共找到 ${sceneSubSections.length} 个可能的场景子章节`);
      
      // 处理找到的场景子章节
      for (const subSection of sceneSubSections) {
        // 使用提取的有意义名称作为场景名称
        const sceneName = this.extractMeaningfulName(subSection.title);
        console.log(`提取到场景: ${sceneName} (来自子章节: ${subSection.title})`);

        // 创建场景对象
        scenes.push({
          name: sceneName,
          content: subSection.content
        });
      }

      if (scenes.length === 0) {
        console.log(`章节 "${detailSection.title}" 未找到有效场景`);
      }
    } else {
      console.log(`章节 "${detailSection.title}" 没有子章节 (###)`);
      // 如果需要把整个章节作为一个场景（在没有子章节的情况下），可以在这里添加逻辑
    }

    console.log(`从章节 "${detailSection.title}" 提取完成，共 ${scenes.length} 个场景`);
    return scenes;
  }
  
  /**
   * 从标题中提取有意义的名称
   */
  private extractMeaningfulName(title: string): string {
    let name = title.trim();
    
    // 1. 优先匹配冒号后的内容 (例如 "场景1：XXX" -> "XXX")
    const colonMatch = name.match(/[：:]\s*(.+)$/);
    if (colonMatch && colonMatch[1]) {
      // 确保冒号后的内容不是忽略词
      const potentialName = colonMatch[1].trim();
      if (!['场景概述', '用户旅程'].includes(potentialName)) {
        return potentialName;
      }
    }
    
    // 2. 匹配 "场景X：" 或 "Scene X:" 前缀后的内容
    const scenePrefixMatch = name.match(/^(?:场景|Scene)\s*\d+\s*[：:]\s*(.+)$/i);
    if (scenePrefixMatch && scenePrefixMatch[1]) {
      const potentialName = scenePrefixMatch[1].trim();
      if (!['场景概述', '用户旅程'].includes(potentialName)) {
        return potentialName;
      }
    }
    
    // 3. 匹配 "X.Y ... " 前缀 (例如 "1.1 XXX" -> "XXX")
    const numberedSubSubMatch = name.match(/^\d+\.\d+\s+(.+)$/);
    if (numberedSubSubMatch && numberedSubSubMatch[1]) {
      const potentialName = numberedSubSubMatch[1].trim();
      // 避免返回忽略词
      if (!['场景概述', '用户旅程'].includes(potentialName)) {
        return potentialName;
      }
    }
    
    // 4. 匹配 "X. ... " 前缀 (例如 "1. XXX" -> "XXX")
    const numberedPrefixMatch = name.match(/^\d+\.\s+(.+)$/);
    if (numberedPrefixMatch && numberedPrefixMatch[1]) {
      const potentialName = numberedPrefixMatch[1].trim();
      // 同样避免返回忽略词
      if (!['场景概述', '用户旅程'].includes(potentialName)) {
        // 如果提取出来的内容还包含冒号，再次尝试提取冒号后的内容
        const innerColonMatch = potentialName.match(/[：:]\s*(.+)$/);
        if (innerColonMatch && innerColonMatch[1]) {
          const innerName = innerColonMatch[1].trim();
          if (!['场景概述', '用户旅程'].includes(innerName)) {
            return innerName;
          }
        }
        return potentialName; // 返回数字后的内容
      }
    }
    
    // 5. 如果以上都没匹配到，移除可能的数字/项目符号前缀 (例如 "1. Foo", "- Foo")
    name = name.replace(/^[\d.\-]+\s*/, '').trim();
    // 再次检查是否只剩下忽略词
    if (['场景概述', '用户旅程'].includes(name)) {
      return title.trim(); // 如果移除前缀后只剩忽略词，返回原始标题
    }
    
    // 6. 移除包围的方括号 ([XXX] -> XXX)
    name = name.replace(/^\[(.+)\]$/, '$1').trim();
    
    // 7. 提取特定关键词后的内容 (例如 "功能模块：")
    const moduleMatch = name.match(/功能模块(?:\/用户故事)?[：:]\s*(.+)$/);
    if (moduleMatch && moduleMatch[1]) {
      name = moduleMatch[1].trim();
    }
    
    // 返回清理后的名称，如果清理后为空，则返回原始标题
    return name || title.trim();
  }
} 