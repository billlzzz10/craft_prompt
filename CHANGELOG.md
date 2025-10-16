# Changelog

All notable changes to the Obsidian AI MCP Plugin will be documented in this file.

## [0.4.0] - 2024-10-02

### 🚀 Major New Features

#### Enhanced Search with Voyage AI Rerank
- **Voyage AI Integration**: Added support for Voyage AI reranking to improve search accuracy
- **Multiple Search Modes**: Semantic, Keyword, Hybrid, and AI-Enhanced search options
- **Smart Filtering**: Advanced filters by tags, folders, dates, and file types
- **Search History**: Track and analyze search patterns
- **Saved Searches**: Save frequently used search queries
- **Search Analytics**: Performance metrics and usage statistics

#### Multi-Provider AI Integration
- **Vercel AI SDK Integration**: Support for multiple AI providers
- **Supported Providers**: OpenAI, Anthropic, Google AI, Mistral
- **Dynamic Provider Switching**: Change providers on-the-fly
- **Structured Output**: Generate tasks, summaries, and analyses
- **Streaming Support**: Real-time response streaming
- **Provider Testing**: Built-in connection testing for all providers

#### Interactive Dashboard
- **Customizable Widgets**: Metrics, Charts, Lists, Markdown, AI Insights
- **Drag & Drop Layout**: Visual layout editor
- **Real-time Metrics**: Live vault statistics and analytics
- **Chart Visualizations**: Line charts, doughnut charts, and more
- **AI Insights Widget**: AI-generated insights about your vault
- **Auto-refresh**: Configurable refresh intervals
- **Widget Configuration**: Customize widget settings and appearance

#### Email Notifications & File Sharing
- **Email Service Integration**: SMTP-based email sending (simulated for demo)
- **File Sharing**: Share individual files or multiple files via email
- **Vault Summaries**: Send comprehensive vault reports
- **Notification Rules**: Automated notifications based on triggers
- **Email Templates**: Customizable email templates
- **Scheduled Reports**: Daily and weekly automated reports

### 📋 New Commands
- `Open AI MCP Dashboard` - Open the interactive dashboard
- `Enhanced Search with Rerank` - Advanced search with reranking
- `Share Current File via Email` - Share the current file via email
- `Send Vault Summary via Email` - Send a vault summary report
- `Test AI Providers` - Test all configured AI providers

### ⚙️ New Settings
- **Voyage AI Settings**: API key, model selection, rerank threshold
- **Vercel AI Settings**: Multiple provider configurations, default provider
- **Email Settings**: SMTP configuration, templates, notification rules
- **Dashboard Settings**: Widget configurations, layout preferences
- **Enhanced Search Settings**: Default search type, history management

### 🔧 Improvements
- **Enhanced User Interface**: New ribbon icons, responsive design improvements
- **Performance Optimizations**: Better caching, batch processing, memory management
- **Developer Experience**: Modular architecture, improved TypeScript definitions

### 📦 Dependencies Added
- `ai`: ^3.3.0 - Vercel AI SDK integration
- `marked`: ^9.1.0 - Markdown rendering for dashboard
- `chart.js`: ^4.4.0 - Chart visualizations

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors
- Improved error handling in async operations
- Better memory cleanup on plugin unload
- Fixed widget refresh intervals
- Improved search result deduplication

## [0.3.0] - 2024-09-23

### 🎉 Major Release - Full Featured AI MCP Plugin

#### ✨ Added
- **Complete Chat Interface**
  - Responsive design for desktop and mobile
  - 3 AI modes: Ask, Planning, Agent
  - Context-aware responses from active notes
  - Smart suggestions and quick actions
  - Export controls integrated in chat

- **Advanced Role System**
  - Dynamic role management with custom templates
  - Role import/export from Markdown files
  - Dedicated `AI Roles/` folder for organization
  - Role management modal with full CRUD operations

- **Memory Graph Implementation**
  - Full schema with nodes (fact, event, task, context, markdown)
  - Edge types: causal, temporal, similar, references
  - JSON-based storage with metadata
  - Graph visualization integration

- **RAG (Retrieval-Augmented Generation)**
  - Mistral embeddings integration (free tier support)
  - Qdrant vector database (local/cloud hybrid)
  - Automatic file change detection and indexing
  - Semantic and hybrid search capabilities

- **Performance Optimization System**
  - Intelligent caching with TTL
  - Batch processing for embeddings
  - Debounced file processing
  - Memory usage optimization
  - Performance metrics tracking

- **Smart Features**
  - Auto-tagging based on content similarity
  - Smart suggestions for tasks and connections
  - Pattern detection and knowledge gap analysis
  - Contextual insights generation
  - Trend identification

- **Cloud Integration**
  - Custom cloud sync endpoints
  - Cloudflare Workers integration (optional)
  - Data export/import functionality
  - Encrypted sync support

#### 🛠️ Technical Improvements
- **TypeScript Implementation**
  - Full type safety with interfaces
  - Zod schema validation
  - Modern ES modules structure
  - ESBuild configuration for optimal bundling

- **Mobile Optimization**
  - Touch-friendly UI elements
  - Responsive layout with toggle panels
  - Platform-specific adaptations
  - Reduced motion support for accessibility

- **Error Handling**
  - Comprehensive error boundaries
  - Graceful degradation
  - User-friendly error messages
  - Debug mode support

#### 📋 Commands Added
- `Open AI Chat Interface` - Launch the main chat interface
- `Initialize Vault Memory` - Full vault scan and indexing
- `Test Vault Recall` - Validate system accuracy
- `Show Smart Suggestions` - Display AI-generated suggestions
- `Auto-tag Current Note` - Automatic content tagging
- `Smart Search` - Hybrid semantic/keyword search
- `Export Memory Graph` - Export graph data
- `Import Memory Graph` - Import graph data
- `Visualize Memory Graph` - Graph visualization
- `Optimize Memory Usage` - Performance optimization
- `Import Role Template` - Import roles from Markdown

#### 🎨 UI/UX Enhancements
- **Professional Styling**
  - Modern CSS with CSS variables
  - Dark/light theme support
  - High contrast mode compatibility
  - Smooth animations and transitions

- **Accessibility Features**
  - ARIA labels and roles
  - Keyboard navigation support
  - Screen reader compatibility
  - Reduced motion preferences

#### ⚙️ Configuration
- **Comprehensive Settings Panel**
  - API key management
  - Database configuration
  - Performance tuning options
  - Cloud sync settings

- **Project Instructions JSON**
  - Centralized configuration
  - Role definitions
  - Performance parameters
  - UI customization options

#### 🔧 Dependencies
- `@langchain/mistralai` - Mistral AI integration
- `@qdrant/js-client-rest` - Qdrant vector database
- `uuid` - Unique identifier generation
- `zod` - Schema validation
- `obsidian` - Obsidian API

#### 📚 Documentation
- Comprehensive README with setup instructions
- Inline code documentation
- Configuration examples
- Troubleshooting guide

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors
- Resolved mobile compatibility issues
- Fixed memory leaks in file watchers
- Corrected API response handling

### 🔄 Breaking Changes
- Initial release - no breaking changes

### 📈 Performance
- Optimized embedding generation with caching
- Reduced memory footprint with lazy loading
- Improved startup time with modular loading
- Enhanced search performance with indexing

### 🔒 Security
- API key secure storage
- Encrypted data transmission options
- Input sanitization
- CORS protection for cloud endpoints

---

## Development Notes

### Architecture Decisions
- **Modular Design**: Separated concerns into distinct classes
- **Performance First**: Built-in optimization from the ground up
- **Mobile Ready**: Responsive design as a core requirement
- **Extensible**: Plugin architecture for future enhancements

### Future Roadmap
- [ ] Additional embedding providers (OpenAI, Cohere)
- [ ] Advanced graph algorithms
- [ ] Collaborative features
- [ ] Plugin marketplace integration
- [ ] Advanced analytics dashboard

### Known Limitations
- Requires internet connection for AI features
- Free tier API limits may apply
- Large vaults may require performance tuning
- Mobile features limited by platform constraints

---

*For detailed technical documentation, see the README.md file.*
