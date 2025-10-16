import { Modal, App, Setting } from 'obsidian';
import { SearchResult } from './enhanced-search';

export class SearchResultsModal extends Modal {
  constructor(app: App, private results: SearchResult[]) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: `Search Results (${this.results.length})` });

    if (this.results.length === 0) {
      contentEl.createEl("p", { text: "No results found." });
      return;
    }

    const resultsContainer = contentEl.createEl("div", { cls: "search-results-container" });

    this.results.forEach((result, index) => {
      const resultEl = resultsContainer.createEl("div", { cls: "search-result-item" });
      
      // Title and score
      const header = resultEl.createEl("div", { cls: "result-header" });
      const title = header.createEl("h3", { text: result.title, cls: "result-title" });
      
      if (result.file) {
        title.onclick = async () => {
          const leaf = this.app.workspace.getLeaf('tab');
          await leaf.openFile(result.file!);
          this.close();
        };
        title.style.cursor = 'pointer';
        title.style.color = 'var(--text-accent)';
      }
      
      const scoreEl = header.createEl("span", { cls: "result-score" });
      if (result.rerankScore !== undefined) {
        scoreEl.setText(`Score: ${result.score.toFixed(3)} | Rerank: ${result.rerankScore.toFixed(3)}`);
      } else {
        scoreEl.setText(`Score: ${result.score.toFixed(3)}`);
      }
      
      // Content preview
      const contentEl = resultEl.createEl("div", { cls: "result-content" });
      const preview = result.content.length > 200 
        ? result.content.substring(0, 200) + '...'
        : result.content;
      contentEl.setText(preview);
      
      // Metadata
      if (result.metadata.highlights && result.metadata.highlights.length > 0) {
        const highlightsEl = resultEl.createEl("div", { cls: "result-highlights" });
        highlightsEl.createEl("strong", { text: "Highlights: " });
        result.metadata.highlights.forEach(highlight => {
          highlightsEl.createEl("span", { 
            text: `"${highlight}" `,
            cls: "highlight-snippet"
          });
        });
      }
      
      // File info
      if (result.metadata.path) {
        const pathEl = resultEl.createEl("div", { cls: "result-path" });
        pathEl.setText(`Path: ${result.metadata.path}`);
      }
    });

    // Close button
    const buttonContainer = contentEl.createEl("div", { cls: "modal-button-container" });
    buttonContainer.createEl("button", { text: "Close" }).onclick = () => this.close();
  }
}
