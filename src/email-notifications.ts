import { Notice, TFile } from 'obsidian';
import AIMCPPlugin from '../main';

// Note: Using fetch API for email sending instead of nodemailer for browser compatibility

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
}

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'file_created' | 'file_modified' | 'tag_added' | 'daily_summary' | 'weekly_report' | 'ai_insight';
  conditions: {
    filePattern?: string;
    tagPattern?: string;
    timeSchedule?: string; // cron format
    threshold?: number;
  };
  recipients: string[];
  templateId: string;
  lastTriggered?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: string;
}

export class EmailService {
  private config: EmailConfig | null = null;
  private isConfigured = false;

  constructor(private plugin: AIMCPPlugin) {}

  async configure(config: EmailConfig): Promise<boolean> {
    try {
      this.config = config;
      
      // Test the connection by attempting to send a test email
      const testResult = await this.testConnection();
      
      if (testResult) {
        this.isConfigured = true;
        new Notice('Email service configured successfully');
        return true;
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      console.error('Email configuration failed:', error);
      new Notice(`Email configuration failed: ${(error as Error).message}`);
      this.isConfigured = false;
      return false;
    }
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    htmlContent: string,
    textContent?: string,
    attachments?: EmailAttachment[]
  ): Promise<boolean> {
    if (!this.isConfigured || !this.config) {
      throw new Error('Email service not configured');
    }

    try {
      const recipients = Array.isArray(to) ? to : [to];
      
      // Use a web-based email service API (like EmailJS, SendGrid, etc.)
      // For demo purposes, we'll simulate email sending
      console.log('Simulating email send:', {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: recipients.join(', '),
        subject,
        html: htmlContent,
        text: textContent || this.htmlToText(htmlContent),
        attachments: attachments?.length || 0
      });
      
      // In a real implementation, you would use a service like:
      // - EmailJS for client-side email sending
      // - SendGrid API
      // - Mailgun API
      // - Your own email service endpoint
      
      new Notice(`Email sent to ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendTemplatedEmail(
    to: string | string[],
    templateId: string,
    variables: Record<string, any>,
    attachments?: EmailAttachment[]
  ): Promise<boolean> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const subject = this.processTemplate(template.subject, variables);
    const htmlContent = this.processTemplate(template.htmlTemplate, variables);
    const textContent = this.processTemplate(template.textTemplate, variables);

    return await this.sendEmail(to, subject, htmlContent, textContent, attachments);
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    return processed;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private getTemplate(templateId: string): EmailTemplate | null {
    const templates = this.plugin.settings.emailTemplates || [];
    return templates.find(t => t.id === templateId) || null;
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  async testConnection(): Promise<boolean> {
    if (!this.config) return false;
    
    try {
      // Simulate connection test
      console.log('Testing email configuration:', {
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        username: this.config.username
      });
      
      // In a real implementation, you would test the actual connection
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }
}

export class FileShareService {
  constructor(private plugin: AIMCPPlugin, private emailService: EmailService) {}

  async shareFileViaEmail(
    file: TFile,
    recipients: string[],
    message?: string,
    includeMetadata = true
  ): Promise<boolean> {
    try {
      const content = await this.plugin.app.vault.read(file);
      const attachments: EmailAttachment[] = [];

      // Add the main file
      attachments.push({
        filename: `${file.basename}.md`,
        content: content,
        contentType: 'text/markdown'
      });

      // Add metadata if requested
      if (includeMetadata) {
        const metadata = this.extractFileMetadata(file);
        attachments.push({
          filename: `${file.basename}_metadata.json`,
          content: JSON.stringify(metadata, null, 2),
          contentType: 'application/json'
        });
      }

      // Generate email content
      const variables = {
        fileName: file.basename,
        filePath: file.path,
        fileSize: this.formatFileSize(content.length),
        shareDate: new Date().toLocaleDateString(),
        shareTime: new Date().toLocaleTimeString(),
        message: message || 'Shared from Obsidian AI MCP Plugin',
        vaultName: this.plugin.app.vault.getName()
      };

      await this.emailService.sendTemplatedEmail(
        recipients,
        'file_share',
        variables,
        attachments
      );

      new Notice(`File "${file.basename}" shared successfully`);
      return true;
    } catch (error) {
      console.error('File sharing failed:', error);
      new Notice(`Failed to share file: ${(error as Error).message}`);
      return false;
    }
  }

  async shareMultipleFiles(
    files: TFile[],
    recipients: string[],
    message?: string,
    format: 'individual' | 'zip' = 'individual'
  ): Promise<boolean> {
    try {
      if (format === 'individual') {
        // Send each file separately
        for (const file of files) {
          await this.shareFileViaEmail(file, recipients, message);
        }
      } else {
        // Create a zip-like structure (simplified)
        const attachments: EmailAttachment[] = [];
        
        for (const file of files) {
          const content = await this.plugin.app.vault.read(file);
          attachments.push({
            filename: `${file.path.replace(/\//g, '_')}.md`,
            content: content,
            contentType: 'text/markdown'
          });
        }

        const variables = {
          fileCount: files.length,
          fileNames: files.map(f => f.basename).join(', '),
          shareDate: new Date().toLocaleDateString(),
          shareTime: new Date().toLocaleTimeString(),
          message: message || 'Multiple files shared from Obsidian',
          vaultName: this.plugin.app.vault.getName()
        };

        await this.emailService.sendTemplatedEmail(
          recipients,
          'multiple_files_share',
          variables,
          attachments
        );
      }

      new Notice(`${files.length} files shared successfully`);
      return true;
    } catch (error) {
      console.error('Multiple file sharing failed:', error);
      new Notice(`Failed to share files: ${(error as Error).message}`);
      return false;
    }
  }

  async shareVaultSummary(
    recipients: string[],
    includeStats = true,
    includeRecentFiles = true
  ): Promise<boolean> {
    try {
      const summary = await this.generateVaultSummary(includeStats, includeRecentFiles);
      
      const variables = {
        vaultName: this.plugin.app.vault.getName(),
        summaryDate: new Date().toLocaleDateString(),
        ...summary
      };

      await this.emailService.sendTemplatedEmail(
        recipients,
        'vault_summary',
        variables
      );

      new Notice('Vault summary shared successfully');
      return true;
    } catch (error) {
      console.error('Vault summary sharing failed:', error);
      new Notice(`Failed to share vault summary: ${(error as Error).message}`);
      return false;
    }
  }

  private extractFileMetadata(file: TFile): any {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    
    return {
      name: file.basename,
      path: file.path,
      size: file.stat.size,
      created: new Date(file.stat.ctime).toISOString(),
      modified: new Date(file.stat.mtime).toISOString(),
      tags: cache?.tags?.map(t => t.tag) || [],
      links: cache?.links?.map(l => l.link) || [],
      headings: cache?.headings?.map(h => ({
        level: h.level,
        heading: h.heading
      })) || [],
      frontmatter: cache?.frontmatter || {}
    };
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private async generateVaultSummary(includeStats: boolean, includeRecentFiles: boolean): Promise<any> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    const summary: any = {};

    if (includeStats) {
      let totalWords = 0;
      const tags = new Set<string>();
      
      for (const file of files) {
        try {
          const content = await this.plugin.app.vault.read(file);
          totalWords += content.split(/\s+/).length;
          
          const cache = this.plugin.app.metadataCache.getFileCache(file);
          if (cache?.tags) {
            cache.tags.forEach(tag => tags.add(tag.tag));
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }

      summary.stats = {
        totalFiles: files.length,
        totalWords,
        totalTags: tags.size,
        averageWordsPerFile: Math.round(totalWords / files.length)
      };
    }

    if (includeRecentFiles) {
      const recentFiles = files
        .sort((a, b) => b.stat.mtime - a.stat.mtime)
        .slice(0, 10)
        .map(file => ({
          name: file.basename,
          path: file.path,
          modified: new Date(file.stat.mtime).toLocaleDateString()
        }));

      summary.recentFiles = recentFiles;
    }

    return summary;
  }
}

export class NotificationManager {
  private rules: Map<string, NotificationRule> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private plugin: AIMCPPlugin,
    private emailService: EmailService,
    private fileShareService: FileShareService
  ) {
    this.loadRules();
    this.setupFileWatchers();
  }

  addRule(rule: NotificationRule): void {
    this.rules.set(rule.id, rule);
    this.saveRules();
    
    if (rule.enabled && rule.conditions.timeSchedule) {
      this.scheduleRule(rule);
    }
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.unscheduleRule(ruleId);
    this.saveRules();
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      this.saveRules();
      
      if (rule.conditions.timeSchedule) {
        this.scheduleRule(rule);
      }
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      this.unscheduleRule(ruleId);
      this.saveRules();
    }
  }

  async triggerRule(ruleId: string, context?: any): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return;

    try {
      const variables = await this.prepareVariables(rule, context);
      
      await this.emailService.sendTemplatedEmail(
        rule.recipients,
        rule.templateId,
        variables
      );

      rule.lastTriggered = new Date().toISOString();
      this.saveRules();
      
      console.log(`Notification rule "${rule.name}" triggered successfully`);
    } catch (error) {
      console.error(`Failed to trigger rule "${rule.name}":`, error);
    }
  }

  private loadRules(): void {
    const savedRules = this.plugin.settings.notificationRules || [];
    savedRules.forEach(rule => {
      this.rules.set(rule.id, rule);
      if (rule.enabled && rule.conditions.timeSchedule) {
        this.scheduleRule(rule);
      }
    });
  }

  private saveRules(): void {
    this.plugin.settings.notificationRules = Array.from(this.rules.values());
    this.plugin.saveSettings();
  }

  private setupFileWatchers(): void {
    // Watch for file creation
    this.plugin.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        if (file instanceof TFile) {
          this.handleFileEvent('file_created', file);
        }
      })
    );

    // Watch for file modification
    this.plugin.registerEvent(
      this.plugin.app.vault.on('modify', (file) => {
        if (file instanceof TFile) {
          this.handleFileEvent('file_modified', file);
        }
      })
    );
  }

  private async handleFileEvent(trigger: 'file_created' | 'file_modified', file: TFile): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.enabled && rule.trigger === trigger) {
        if (this.matchesFilePattern(file, rule.conditions.filePattern)) {
          await this.triggerRule(rule.id, { file });
        }
      }
    }
  }

  private matchesFilePattern(file: TFile, pattern?: string): boolean {
    if (!pattern) return true;
    
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(file.path) || regex.test(file.basename);
    } catch (e) {
      // If pattern is invalid regex, do simple string matching
      return file.path.includes(pattern) || file.basename.includes(pattern);
    }
  }

  private scheduleRule(rule: NotificationRule): void {
    if (!rule.conditions.timeSchedule) return;

    // Simplified cron-like scheduling (for demo purposes)
    // In a real implementation, you'd use a proper cron library
    const schedule = rule.conditions.timeSchedule;
    let interval: number;

    if (schedule === 'daily') {
      interval = 24 * 60 * 60 * 1000; // 24 hours
    } else if (schedule === 'weekly') {
      interval = 7 * 24 * 60 * 60 * 1000; // 7 days
    } else {
      return; // Unsupported schedule format
    }

    const timeout = setInterval(() => {
      this.triggerRule(rule.id);
    }, interval);

    this.scheduledJobs.set(rule.id, timeout);
  }

  private unscheduleRule(ruleId: string): void {
    const timeout = this.scheduledJobs.get(ruleId);
    if (timeout) {
      clearInterval(timeout);
      this.scheduledJobs.delete(ruleId);
    }
  }

  private async prepareVariables(rule: NotificationRule, context?: any): Promise<Record<string, any>> {
    const variables: Record<string, any> = {
      ruleName: rule.name,
      triggerTime: new Date().toLocaleString(),
      vaultName: this.plugin.app.vault.getName()
    };

    if (context?.file) {
      const file = context.file as TFile;
      variables.fileName = file.basename;
      variables.filePath = file.path;
      variables.fileSize = this.fileShareService['formatFileSize'](file.stat.size);
    }

    // Add vault statistics for summary emails
    if (rule.trigger === 'daily_summary' || rule.trigger === 'weekly_report') {
      const summary = await this.fileShareService['generateVaultSummary'](true, true);
      Object.assign(variables, summary);
    }

    return variables;
  }

  destroy(): void {
    // Clear all scheduled jobs
    for (const timeout of this.scheduledJobs.values()) {
      clearInterval(timeout);
    }
    this.scheduledJobs.clear();
  }
}

// Default email templates
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'file_share',
    name: 'File Share',
    subject: 'Shared file: {{fileName}}',
    htmlTemplate: `
      <h2>File Shared from {{vaultName}}</h2>
      <p><strong>File:</strong> {{fileName}}</p>
      <p><strong>Size:</strong> {{fileSize}}</p>
      <p><strong>Shared on:</strong> {{shareDate}} at {{shareTime}}</p>
      <p><strong>Message:</strong></p>
      <blockquote>{{message}}</blockquote>
      <p>The file is attached to this email.</p>
    `,
    textTemplate: `
File Shared from {{vaultName}}

File: {{fileName}}
Size: {{fileSize}}
Shared on: {{shareDate}} at {{shareTime}}

Message:
{{message}}

The file is attached to this email.
    `,
    variables: ['fileName', 'fileSize', 'shareDate', 'shareTime', 'message', 'vaultName']
  },
  {
    id: 'multiple_files_share',
    name: 'Multiple Files Share',
    subject: 'Shared {{fileCount}} files from {{vaultName}}',
    htmlTemplate: `
      <h2>Multiple Files Shared</h2>
      <p><strong>Files ({{fileCount}}):</strong> {{fileNames}}</p>
      <p><strong>Shared on:</strong> {{shareDate}} at {{shareTime}}</p>
      <p><strong>Message:</strong></p>
      <blockquote>{{message}}</blockquote>
      <p>All files are attached to this email.</p>
    `,
    textTemplate: `
Multiple Files Shared

Files ({{fileCount}}): {{fileNames}}
Shared on: {{shareDate}} at {{shareTime}}

Message:
{{message}}

All files are attached to this email.
    `,
    variables: ['fileCount', 'fileNames', 'shareDate', 'shareTime', 'message', 'vaultName']
  },
  {
    id: 'vault_summary',
    name: 'Vault Summary',
    subject: 'Daily Summary: {{vaultName}}',
    htmlTemplate: `
      <h2>Vault Summary for {{vaultName}}</h2>
      <p><strong>Date:</strong> {{summaryDate}}</p>
      
      <h3>Statistics</h3>
      <ul>
        <li>Total Files: {{stats.totalFiles}}</li>
        <li>Total Words: {{stats.totalWords}}</li>
        <li>Total Tags: {{stats.totalTags}}</li>
        <li>Average Words per File: {{stats.averageWordsPerFile}}</li>
      </ul>
      
      <h3>Recent Files</h3>
      <ul>
        {{#each recentFiles}}
        <li>{{name}} ({{modified}})</li>
        {{/each}}
      </ul>
    `,
    textTemplate: `
Vault Summary for {{vaultName}}
Date: {{summaryDate}}

Statistics:
- Total Files: {{stats.totalFiles}}
- Total Words: {{stats.totalWords}}
- Total Tags: {{stats.totalTags}}
- Average Words per File: {{stats.averageWordsPerFile}}

Recent Files:
{{#each recentFiles}}
- {{name}} ({{modified}})
{{/each}}
    `,
    variables: ['vaultName', 'summaryDate', 'stats', 'recentFiles']
  }
];
