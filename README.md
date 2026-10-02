<div align="center">

# 💰 موزع الاعتمادات — Credit Distributor

### 🏛️ خطة التدفقات النقدية | Cash Flow Planning System

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Excel Export](https://img.shields.io/badge/Excel_Export-217346?style=for-the-badge&logo=microsoft-excel&logoColor=white)](https://sheetjs.com/)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-brightgreen?style=flat-square)]()
[![RTL Support](https://img.shields.io/badge/RTL-Arabic%20UI-blue?style=flat-square)]()

---

**A professional browser-based tool for Egyptian government entities to intelligently distribute annual budget credits across fiscal months — with smart declining patterns, configurable variance, and instant Excel export.**

> 🇪🇬 أداة متخصصة لتوزيع الاعتمادات المالية على شهور السنة المالية لجهات الحكومة المصرية

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Smart Distribution** | Automatically distributes annual budgets across 1–24 months using a realistic declining pattern |
| 🎲 **Variance Control** | 5-level variance slider from "very uniform" to "very varied" — no two distributions look the same |
| 📅 **Flexible Start Month** | Choose any month (Jan–Dec) as the fiscal year start |
| 🔒 **First Month Cap** | Set a min/max range for the first month amount with a live visual range bar |
| 📌 **Fixed First Month** | Pin a specific amount to the first month per budget line |
| 📝 **Notes Column** | Optional notes column per budget line, toggleable |
| 📤 **Excel Export** | Exports a beautifully styled 2-sheet `.xlsx` file (Distribution + Cumulative) |
| 🖨️ **Print Ready** | Clean print layout with one click |
| 💾 **Auto-Save** | All data persists automatically in `localStorage` — never lose your work |
| 🧪 **Sample Data** | Load 40+ real-world Egyptian government budget lines instantly |
| ⌨️ **Keyboard Shortcut** | `Ctrl + Enter` to distribute instantly |
| 📱 **Responsive** | Works on desktop and tablet |
| 🌙 **RTL UI** | Full Arabic right-to-left interface |

---

## 🖼️ Screenshots

> *Distribution settings panel with month selector and variance control*

```
┌──────────────────────────────────────────────────┐
│  💰 موزع الاعتمادات    خطة التدفقات النقدية       │
│─────────────────────────────────────────────────│
│  اسم الجهة: وزارة المالية — الإدارة المركزية    │
│  السنة المالية: 2027  │  عدد الشهور: 12          │
│  درجة التباين: ●●●○○  معتدل                      │
│─────────────────────────────────────────────────│
│  يناير  فبراير  مارس  أبريل  مايو  يونيو ...     │
│  18.5%  16.2%  14.1%  12.3%  10.8%  9.4%  ...  │
└──────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

No build tools, no npm, no installation required. Just open and use.

### Option 1 — Open directly in browser

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/financial-management.git

# Navigate into the folder
cd financial-management

# Open index.html in your browser
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

### Option 2 — Live Server (VS Code)

1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
2. Right-click `index.html` → **Open with Live Server**

---

## 📖 How to Use

### Step 1 — Configure Settings
- Enter your **entity name** and **fiscal year**
- Set the **number of months** (1–24)
- Adjust the **variance level** (1 = uniform, 5 = highly varied)
- Select the **start month** from the month chips
- Optionally enable the **first month cap** with a min/max range

### Step 2 — Enter Budget Lines
- Click **➕ Add Row** to add budget items
- Fill in: Account Code · Description · Total Credit · (Optional) First Month Amount · Notes
- Or click **📄 Sample Data** to load 40+ real lines instantly

### Step 3 — Distribute
- Click **⚡ توزيع** (or press `Ctrl + Enter`)
- Review the distribution table with monthly breakdown
- Click **🔄 إعادة توزيع** to regenerate with a new random seed

### Step 4 — Export
- Click **📥 تصدير** to export a styled Excel file
- The `.xlsx` contains two sheets:
  - **Sheet 1**: Monthly distribution per budget line
  - **Sheet 2**: Cumulative totals with completion percentage

---

## 📁 Project Structure

```
📦 financial-management/
 ├── 📄 index.html          # Main HTML — layout & UI structure
 ├── 🎨 styles.css          # Full styling — dark header, cards, RTL layout
 ├── ⚙️  app.js              # Core logic — distribute, export, cap controls
 ├── 🔧 utils.js            # Math helpers — seeded RNG, distribution algorithm
 ├── 🖼️  ui.js               # UI rendering — table rows, preview, toast, chips
 ├── 📊 data.js             # Constants — month names (AR/EN), sample data
 └── 📦 xlsx.bundle.js      # SheetJS bundled — Excel generation (offline)
```

---

## 🧮 Distribution Algorithm

The distribution uses a **seeded pseudo-random declining pattern**:

1. Generate weights using exponential decay: `weight[i] = (count - i / count)^0.6 × count`
2. Add controlled noise based on the variance level (spread: `0.04` → `0.30`)
3. Sort descending to guarantee a monotonically declining sequence
4. Normalize weights to sum to `total` with 2-decimal rounding
5. Fix rounding drift on the last element

This ensures:
- ✅ Each month is strictly less than the previous
- ✅ The sum always equals exactly the total credit
- ✅ Results are reproducible via seed, but look natural
- ✅ Re-distributing gives a visually different (but still valid) result

---

## 📊 Excel Export Structure

The exported `.xlsx` file is production-quality with:

| Sheet | Content |
|---|---|
| **خطة التدفقات النقدية** | Monthly distribution with styled header, totals row, and color-coded accuracy check |
| **التراكمي** | Cumulative monthly totals + completion percentage per line |

Styling includes:
- 🎨 Color-coded rows (alternating white/light blue)
- ✅ Green totals row when sum matches, 🔴 red when there's a discrepancy
- 📌 Frozen header rows for easy scrolling
- 📐 Auto-fitted column widths
- 🔤 RTL reading order with Arabic + English month headers

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| **Vanilla HTML5** | Structure & semantic markup |
| **Pure CSS3** | Styling, animations, responsive layout, RTL |
| **Vanilla JavaScript (ES6+)** | All logic — no frameworks, no bundlers |
| **[SheetJS (xlsx)](https://sheetjs.com/)** | Client-side Excel generation (bundled offline) |
| **localStorage API** | Auto-save & state persistence |

> 🔌 Zero external dependencies at runtime — fully offline capable

---

## ⚙️ Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Mobile Chrome | ✅ Supported |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git commit -m "feat: add your feature description"

# 4. Push to your fork
git push origin feature/your-feature-name

# 5. Open a Pull Request
```

### Commit Convention
| Prefix | Use for |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `style:` | UI/CSS changes |
| `docs:` | Documentation |
| `refactor:` | Code cleanup |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

Developed with ❤️ for the Egyptian public finance sector.

---

<div align="center">

**⭐ If this project helped you, please give it a star!**

*Built with pure HTML, CSS & JavaScript — no frameworks needed*

</div>
