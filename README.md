
# Obsidian AI MCP Plugin v0.4.0

## 🚀 ฟีเจอร์ใหม่ในเวอร์ชัน 0.4.0

### 🧠 ภาพรวม

ปลั๊กอิน AI MCP (Model Context Protocol) สำหรับ Obsidian ที่มีความสามารถขั้นสูงในการจัดการความรู้ด้วย AI พร้อมฟีเจอร์ครบครันและการปรับปรุงใหม่:

**ฟีเจอร์หลัก:**
- **Memory Graph**: ระบบกราฟความทรงจำที่เชื่อมโยงข้อมูลอย่างชาญฉลาด
- **RAG (Retrieval-Augmented Generation)**: ค้นหาและดึงข้อมูลจาก vault ด้วย Mistral embeddings
- **Chat Interface**: หน้าต่างแชทแบบ responsive พร้อมโหมด 3 แบบ
- **Role-based AI**: ระบบ AI ที่ปรับเปลี่ยนบทบาทได้ตามความต้องการ
- **Performance Optimization**: การปรับปรุงประสิทธิภาพแบบอัตโนมัติ

**ฟีเจอร์ใหม่ในเวอร์ชัน 0.4.0:**
- 🔍 **Enhanced Search with Voyage AI Rerank**: ระบบค้นหาขั้นสูงด้วย reranking
- 🤖 **Multi-Provider AI Integration**: รองรับ AI providers หลายตัวผ่าน Vercel AI SDK
- 📊 **Interactive Dashboard**: แดชบอร์ดแบบ interactive พร้อม widgets และ charts
- 📧 **Email Notifications & File Sharing**: ระบบแจ้งเตือนและแชร์ไฟล์ทางอีเมล
- 🎯 **Smart Features**: Auto-tagging, Smart suggestions, Pattern detection

## 🚀 การติดตั้ง

### ขั้นตอนที่ 1: คัดลอกไฟล์
```bash
# คัดลอกโฟลเดอร์ทั้งหมดไปยัง
.obsidian/plugins/obsidian-ai-mcp-plugin/
```

### ขั้นตอนที่ 2: ติดตั้ง Dependencies
```bash
cd .obsidian/plugins/obsidian-ai-mcp-plugin/
npm install
```

### ขั้นตอนที่ 3: เปิดใช้งานใน Obsidian
1. เปิด Settings > Community Plugins
2. เปิดใช้งาน "AI MCP Plugin"
3. หรือใช้ Plugin Development Tool สำหรับ hot-reload

### ขั้นตอนที่ 4: ตั้งค่า API Keys
1. เปิด Settings > AI MCP Plugin
2. ใส่ **Mistral API Key** (ฟรี tier มีให้)
3. ตั้งค่า **Qdrant URL** (local: `http://localhost:6333`)
4. (ใหม่) ใส่ **Voyage AI API Key** สำหรับ reranking
5. (ใหม่) ตั้งค่า **AI Providers** (OpenAI, Anthropic, Google, Mistral)
6. (ใหม่) ตั้งค่า **Email Configuration** สำหรับการแจ้งเตือน

### ขั้นตอนที่ 5: เริ่มต้นใช้งาน
1. รันคำสั่ง "Initialize Vault Memory (Full Scan)"
2. ทดสอบด้วย "Test Vault Recall"
3. เปิด AI Chat ด้วยไอคอน 🧠 ใน ribbon
4. (ใหม่) เปิด Dashboard ด้วยไอคอน 📊 ใน ribbon

## 🎯 ฟีเจอร์หลัก

### 💬 Chat Interface
- **3 โหมดการทำงาน**: Ask, Planning, Agent
- **Responsive Design**: ใช้งานได้ทั้งเดสก์ท็อปและมือถือ
- **Context-Aware**: ดึงบริบทจากโน้ตที่เปิดอยู่
- **Smart Suggestions**: แนะนำคำถามที่เหมาะสม

### 🧠 Memory Graph
- **Node Types**: fact, event, task, context, markdown
- **Edge Types**: causal, temporal, similar, references
- **Auto-Indexing**: จัดทำดัชนีอัตโนมัติเมื่อไฟล์เปลี่ยนแปลง
- **Graph Visualization**: แสดงผลกราฟใน Obsidian

### 🔍 Enhanced Search (ใหม่!)
- **Voyage AI Reranking**: ปรับปรุงความแม่นยำของผลการค้นหา
- **4 โหมดการค้นหา**: Semantic, Keyword, Hybrid, AI-Enhanced
- **Smart Filters**: กรองตาม tags, folders, dates, file types
- **Search History**: บันทึกประวัติการค้นหา
- **Saved Searches**: บันทึกการค้นหาที่ใช้บ่อย

### 🤖 Multi-Provider AI Integration (ใหม่!)
- **Vercel AI SDK**: รองรับ AI providers หลายตัว
- **Supported Providers**: OpenAI, Anthropic, Google AI, Mistral
- **Dynamic Provider Switching**: เปลี่ยน provider ได้ตามต้องการ
- **Structured Output**: สร้าง tasks, summaries, analyses
- **Streaming Support**: รองรับการตอบสนองแบบ real-time

### 📊 Interactive Dashboard (ใหม่!)
- **Customizable Widgets**: ปรับแต่ง widgets ได้ตามต้องการ
- **Real-time Metrics**: สถิติ vault แบบ real-time
- **Charts & Visualizations**: กราฟและการแสดงผลข้อมูล
- **AI Insights**: ข้อมูลเชิงลึกจาก AI
- **Markdown Rendering**: แสดงผล markdown ใน widgets
- **Drag & Drop Layout**: จัดเรียง layout ด้วยการลาก

### 📧 Email Notifications & File Sharing (ใหม่!)
- **Email Templates**: เทมเพลตอีเมลที่ปรับแต่งได้
- **Notification Rules**: กฎการแจ้งเตือนแบบอัตโนมัติ
- **File Sharing**: แชร์ไฟล์ผ่านอีเมล
- **Vault Summaries**: ส่งสรุป vault ทางอีเมล
- **Scheduled Reports**: รายงานตามกำหนดเวลา

### 🎭 Role System
- **Dynamic Roles**: สร้างและจัดการ role ได้เอง
- **Role Templates**: นำเข้า/ส่งออก role template
- **Custom Prompts**: ปรับแต่ง system prompt ได้
- **Role Folder**: จัดเก็บใน `AI Roles/` folder

### ⚡ Performance Features
- **Caching System**: แคชผลลัพธ์เพื่อความเร็ว
- **Batch Processing**: ประมวลผลแบบกลุ่ม
- **Lazy Loading**: โหลดไฟล์เมื่อจำเป็น
- **Memory Optimization**: จัดการหน่วยความจำอัตโนมัติ

## 📋 คำสั่งที่มีให้ใช้

### คำสั่งหลัก
| คำสั่ง | คำอธิบาย |
|--------|----------|
| `Open AI Chat Interface` | เปิดหน้าต่างแชท AI |
| `Open AI MCP Dashboard` | เปิดแดชบอร์ด (ใหม่!) |
| `Initialize Vault Memory` | สแกนและจัดทำดัชนี vault ทั้งหมด |
| `Test Vault Recall` | ทดสอบความแม่นยำของระบบ |

### คำสั่งค้นหาขั้นสูง (ใหม่!)
| คำสั่ง | คำอธิบาย |
|--------|----------|
| `Enhanced Search with Rerank` | ค้นหาขั้นสูงด้วย reranking |
| `Smart Search` | ค้นหาแบบอัจฉริยะ |

### คำสั่งการแชร์และแจ้งเตือน (ใหม่!)
| คำสั่ง | คำอธิบาย |
|--------|----------|
| `Share Current File via Email` | แชร์ไฟล์ปัจจุบันทางอีเมล |
| `Send Vault Summary via Email` | ส่งสรุป vault ทางอีเมล |

### คำสั่งอื่นๆ
| คำสั่ง | คำอธิบาย |
|--------|----------|
| `Show Smart Suggestions` | แสดงคำแนะนำอัจฉริยะ |
| `Auto-tag Current Note` | แท็กโน้ตปัจจุบันอัตโนมัติ |
| `Export Memory Graph` | ส่งออกกราฟความทรงจำ |
| `Import Memory Graph` | นำเข้ากราฟความทรงจำ |
| `Visualize Memory Graph` | แสดงผลกราฟใน Obsidian |
| `Optimize Memory Usage` | ปรับปรุงการใช้หน่วยความจำ |
| `Test AI Providers` | ทดสอบ AI providers (ใหม่!) |

## ⚙️ การตั้งค่า

### Mistral API
1. สมัครที่ [Mistral AI](https://mistral.ai/)
2. รับ API key (ฟรี tier มี 1M tokens/เดือน)
3. ใส่ใน Settings > AI MCP Plugin

### Voyage AI (ใหม่!)
1. สมัครที่ [Voyage AI](https://www.voyageai.com/)
2. รับ API key สำหรับ reranking
3. ใส่ใน Settings > AI MCP Plugin > Voyage AI

### Multi-Provider AI (ใหม่!)
1. ตั้งค่า API keys สำหรับ providers ที่ต้องการ:
   - OpenAI: [platform.openai.com](https://platform.openai.com/)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/)
   - Google AI: [ai.google.dev](https://ai.google.dev/)
   - Mistral: [console.mistral.ai](https://console.mistral.ai/)
2. เลือก default provider ใน settings

### Qdrant Setup
#### Local (แนะนำ)
```bash
# ใช้ Docker
docker run -p 6333:6333 qdrant/qdrant

# หรือติดตั้งแบบ standalone
# ดาวน์โหลดจาก https://qdrant.tech/
```

#### Cloud
1. สมัครที่ [Qdrant Cloud](https://cloud.qdrant.io/)
2. สร้าง cluster
3. ใส่ URL และ API key ใน settings

### Email Configuration (ใหม่!)
1. ตั้งค่า SMTP server:
   - Gmail: smtp.gmail.com:587
   - Outlook: smtp-mail.outlook.com:587
   - Yahoo: smtp.mail.yahoo.com:587
2. ใส่ username และ password
3. ตั้งค่า from email และ name

## 🎨 การปรับแต่ง UI

### Dashboard Customization (ใหม่!)
- **Widget Types**: Metrics, Charts, Lists, Markdown, AI Insights
- **Layout Editor**: ลากและวาง widgets
- **Auto-refresh**: ตั้งเวลา refresh อัตโนมัติ
- **Export/Import**: บันทึกและแชร์ layout

### Mobile Optimization
- ปุ่ม toggle สำหรับ context panel
- Layout ปรับตัวตามขนาดหน้าจอ
- Touch-friendly controls

### Theme Support
- รองรับ light/dark theme
- ปรับตัวตาม Obsidian theme
- High contrast mode support

## 📊 Performance Metrics

### Enhanced Search Analytics (ใหม่!)
- Search history tracking
- Query performance metrics
- Rerank effectiveness analysis
- Popular search patterns

### Cache Statistics
- Hit rate tracking
- Memory usage monitoring
- Performance optimization suggestions

### AI Usage Analytics (ใหม่!)
- Provider usage statistics
- Token consumption tracking
- Response time analysis
- Error rate monitoring

## 🔧 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

**1. Embeddings ไม่ทำงาน**
- ตรวจสอบ Mistral API key
- ตรวจสอบ rate limit (ฟรี tier)

**2. Qdrant connection failed**
- ตรวจสอบว่า Qdrant server ทำงาน
- ตรวจสอบ URL และ port

**3. Chat ไม่ตอบสนอง**
- ตรวจสอบ API keys
- ดู console สำหรับ error messages

**4. Enhanced Search ไม่ทำงาน (ใหม่!)**
- ตรวจสอบ Voyage AI API key
- ตรวจสอบ network connectivity
- ลองใช้ search mode อื่น

**5. Dashboard ไม่โหลด (ใหม่!)**
- รีเฟรช dashboard
- ตรวจสอบ widget configurations
- ดู browser console สำหรับ errors

**6. Email ไม่ส่ง (ใหม่!)**
- ตรวจสอบ SMTP settings
- ตรวจสอบ email credentials
- ตรวจสอบ firewall/network

### Debug Mode
```javascript
// เปิด debug ใน console
window.aiMcpPlugin.performanceOptimizer.getPerformanceMetrics()
window.aiMcpPlugin.enhancedSearch.getSearchAnalytics()
window.aiMcpPlugin.vercelAI.testAllProviders()
```

## 🔐 Security

หากคุณพบช่องโหว่ด้านความปลอดภัย กรุณาติดต่อเราที่ `billlzzz8@zoho.com`

## 🤝 การพัฒนาต่อ

### Architecture
```
main.ts                 # Main plugin class
├── src/
│   ├── performance.ts  # Performance optimization
│   ├── advanced-features.ts # Smart features
│   ├── voyage-ai.ts    # Voyage AI integration (ใหม่!)
│   ├── vercel-ai.ts    # Vercel AI SDK integration (ใหม่!)
│   ├── dashboard.ts    # Interactive dashboard (ใหม่!)
│   ├── email-notifications.ts # Email system (ใหม่!)
│   ├── enhanced-search.ts # Enhanced search engine (ใหม่!)
│   └── search-results-modal.ts # Search results UI (ใหม่!)
├── styles.css         # UI styling
└── ai-mcp-instructions.json # Configuration
```

### Extension Points
- Custom role templates
- Additional embedding providers
- New search algorithms
- Custom dashboard widgets
- Email template customization
- AI provider integrations

## 📄 License

MIT License - ใช้งานและปรับแต่งได้อย่างอิสระ

## 🙏 Credits

- **Obsidian API**: สำหรับ plugin framework
- **Mistral AI**: สำหรับ embeddings
- **Voyage AI**: สำหรับ reranking (ใหม่!)
- **Vercel AI SDK**: สำหรับ multi-provider integration (ใหม่!)
- **Qdrant**: สำหรับ vector database
- **Chart.js**: สำหรับ dashboard visualizations (ใหม่!)
- **Marked**: สำหรับ markdown rendering (ใหม่!)

---

## 🚀 เริ่มต้นใช้งาน

1. **ติดตั้งปลั๊กอิน** ตามขั้นตอนข้างต้น
2. **ตั้งค่า API keys** ใน settings
3. **รัน Initialize Vault Memory** เพื่อสแกน vault
4. **เปิด AI Chat** และเริ่มสนทนา!
5. **สำรวจ Dashboard** เพื่อดูข้อมูลเชิงลึก
6. **ทดลองใช้ Enhanced Search** เพื่อค้นหาข้อมูลได้แม่นยำขึ้น

## 🆕 สิ่งใหม่ในเวอร์ชัน 0.4.0

### 🔍 Enhanced Search
- Voyage AI reranking เพื่อผลการค้นหาที่แม่นยำขึ้น
- 4 โหมดการค้นหา: Semantic, Keyword, Hybrid, AI-Enhanced
- Search history และ saved searches
- Advanced filtering และ sorting

### 🤖 Multi-Provider AI
- รองรับ OpenAI, Anthropic, Google AI, Mistral
- Dynamic provider switching
- Structured output generation
- Streaming responses

### 📊 Interactive Dashboard
- Customizable widgets และ layouts
- Real-time vault metrics
- Charts และ visualizations
- AI-generated insights

### 📧 Email Integration
- Email notifications และ alerts
- File sharing via email
- Vault summaries และ reports
- Customizable templates

### 🎯 Smart Features
- Improved auto-tagging
- Enhanced smart suggestions
- Pattern detection
- Knowledge gap analysis

สำหรับคำถามและการสนับสนุน กรุณาเปิด issue ใน GitHub repository

**Happy Knowledge Management with Enhanced AI! 🧠✨📊**
