import { useMemo, useState } from "react"
import html2pdf from "html2pdf.js"
import "./App.css"
import products from "./data/products"
import parts from "./data/parts"

const LOGO = "/photos/innova-logo.png"
const WHITE_GLOVE_FEE = 3500
const WHITE_GLOVE_MACHINE_MARKUP = 1.05

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0)
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function getDisplayPrice(product, pricingView) {
  if (pricingView === "whiteGlove" && product.category === "Machine") {
    return product.price * WHITE_GLOVE_MACHINE_MARKUP
  }

  return product.price
}

function getMachineFamily(product) {
  const match = product.name.match(/^(INNOVA M\d+(?: Autopilot)?)/i)
  if (!match) return product.name

  return match[1]
    .replace(/ Autopilot$/i, " w/ Autopilot")
    .trim()
}

function getMachineSize(product) {
  if (product._virtualFrameSize) return product._virtualFrameSize

  const match = product.name.match(/(\d+)' Frame/i)
  return match ? `${match[1]}'` : ""
}

function App() {
  const [dealerInfo, setDealerInfo] = useState({
    date: new Date().toISOString().slice(0, 10),
    dealerName: "",
    poNumber: "",
    customerName: "",
    customerAddress: "",
    customerContact: "",
    notes: "",
  })

  const [pricingView, setPricingView] = useState("wholesale")
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [selectedItems, setSelectedItems] = useState({})
  const [machineSizes, setMachineSizes] = useState({})
  const [searchTerm, setSearchTerm] = useState("")
  const [themeMode, setThemeMode] = useState("light")
  const [activeTab, setActiveTab] = useState("order")
  const [partsSearch, setPartsSearch] = useState("")
  const [partsCart, setPartsCart] = useState({})

  const categories = useMemo(() => {
    const grouped = {}

    products.forEach((product) => {
      if (!grouped[product.category]) grouped[product.category] = []
      grouped[product.category].push(product)
    })

    return grouped
  }, [])

  const machineGroups = useMemo(() => {
    const grouped = {}

    products
      .filter((product) => product.category === "Machine")
      .forEach((product) => {
        const family = getMachineFamily(product)

        if (!grouped[family]) {
          grouped[family] = []
        }

        grouped[family].push(product)
      })

    // Add the new 5' and 8' frame-size options for every machine family.
    // They use the same price as the first configured frame size and N/A as SKU.
    Object.entries(grouped).forEach(([family, variants]) => {
      const reference = variants[0]

      ;["5'", "8'"].forEach((size) => {
        if (!variants.some((product) => getMachineSize(product) === size)) {
          variants.unshift({
            ...reference,
            sku: "N/A",
            name: `${family} - ${size} Frame`,
            image: reference.image,
            price: reference.price,
            selectionType: "required-single",
            _virtualFrameSize: size,
          })
        }
      })
    })

    return grouped
  }, [])

  const filteredCategories = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    if (!search) return categories

    const filtered = {}

    Object.entries(categories).forEach(([category, items]) => {
      if (category === "Machine") {
        const machineMatches = items.filter((product) => {
          return (
            product.name.toLowerCase().includes(search) ||
            product.sku.toLowerCase().includes(search) ||
            product.category.toLowerCase().includes(search)
          )
        })

        if (machineMatches.length > 0) {
          filtered[category] = machineMatches
        }
        return
      }

      const matches = items.filter((product) => {
        return (
          product.name.toLowerCase().includes(search) ||
          product.sku.toLowerCase().includes(search) ||
          product.category.toLowerCase().includes(search)
        )
      })

      if (matches.length > 0) filtered[category] = matches
    })

    return filtered
  }, [categories, searchTerm])

  const quoteItems = useMemo(() => {
    const items = []

    if (selectedMachine) items.push({ ...selectedMachine, qty: 1 })

    Object.values(selectedItems).forEach((item) => items.push(item))

    return items
  }, [selectedMachine, selectedItems])

  const itemsSubtotal = quoteItems.reduce(
    (total, item) => total + getDisplayPrice(item, pricingView) * item.qty,
    0
  )

  const subtotal =
    itemsSubtotal + (pricingView === "whiteGlove" ? WHITE_GLOVE_FEE : 0)

  const keyboardTray = products.find((p) => p.sku === "ACC1064")
  const wheelKit = products.find((p) => p.sku === "ACC1206")
  const steelShankAdapter = products.find((p) => p.sku === "ACC1187")

  const quickChangeFootSkus = new Set([
    "ACC1193",
    "ACC1194",
    "ACC1203",
    "ACC1204",
    "ACC1205",
  ])

  const clearPlasticFootSkus = new Set([
    "ACC1184",
    "ACC1185",
    "ACC1186",
  ])

  const hasAutopilot = selectedMachine?.name
    ?.toLowerCase()
    .includes("autopilot")

  const isM28 = selectedMachine?.name
    ?.toLowerCase()
    .includes("m28")

  const hasRecommendedFoot =
    Object.keys(selectedItems).some(
      (sku) => quickChangeFootSkus.has(sku) || clearPlasticFootSkus.has(sku)
    )

  const recommendations = []

  if (hasAutopilot && keyboardTray && !selectedItems[keyboardTray.sku]) {
    recommendations.push({
      id: keyboardTray.sku,
      product: keyboardTray,
      title: "Keyboard and Mouse Tray",
      description: "Recommended with AutoPilot packages.",
    })
  }

  if (isM28 && wheelKit && !selectedItems[wheelKit.sku]) {
    recommendations.push({
      id: wheelKit.sku,
      product: wheelKit,
      title: "HP Double Bearing Carriage Wheel Kit",
      description: "Recommended with M28 machines.",
    })
  }

  if (
    hasRecommendedFoot &&
    steelShankAdapter &&
    !selectedItems[steelShankAdapter.sku]
  ) {
    recommendations.push({
      id: steelShankAdapter.sku,
      product: steelShankAdapter,
      title: "Steel Shank Adapter and Spring",
      description: "Recommended with Quick Change and Clear Plastic feet.",
    })
  }

  function selectMachine(product) {
    setSelectedMachine(product)

    setMachineSizes((prev) => ({
      ...prev,
      [getMachineFamily(product)]: getMachineSize(product),
    }))

    setTimeout(() => {
      const nextSection = document.querySelector(
        ".category-section:not(.machine-section)"
      )

      if (nextSection) {
        nextSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
    }, 150)
  }

  function handleMachineSizeChange(family, size) {
    const variants = machineGroups[family] || []
    const variant = variants.find((product) => getMachineSize(product) === size)

    setMachineSizes((prev) => ({
      ...prev,
      [family]: size,
    }))

    if (variant) {
      setSelectedMachine(variant)
    }
  }

  function toggleProduct(product) {
    if (product.selectionType === "required-single") {
      selectMachine(product)
      return
    }

    setSelectedItems((prev) => {
      const copy = { ...prev }

      if (copy[product.sku]) {
        delete copy[product.sku]
      } else {
        copy[product.sku] = {
          ...product,
          qty: 1,
        }
      }

      return copy
    })
  }

  function updateQty(sku, qty) {
    setSelectedItems((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        qty: Math.max(1, Number(qty) || 1),
      },
    }))
  }

  function removeItem(sku) {
    if (selectedMachine?.sku === sku) {
      setSelectedMachine(null)
      return
    }

    setSelectedItems((prev) => {
      const copy = { ...prev }
      delete copy[sku]
      return copy
    })
  }

  function getPdfSubtotal() {
    return (
      itemsSubtotal + (pricingView === "whiteGlove" ? WHITE_GLOVE_FEE : 0)
    )
  }

  const filteredParts = useMemo(() => {
    const query = partsSearch.trim().toLowerCase()

    if (!query) return parts

    return parts.filter(
      (part) =>
        part.sku.toLowerCase().includes(query) ||
        part.name.toLowerCase().includes(query)
    )
  }, [partsSearch])

  const partsCartItems = Object.values(partsCart)

  const partsSubtotal = partsCartItems.reduce(
    (total, part) => total + part.price * part.qty,
    0
  )

  function addPart(part) {
    setPartsCart((prev) => ({
      ...prev,
      [part.sku]: prev[part.sku]
        ? { ...prev[part.sku], qty: prev[part.sku].qty + 1 }
        : { ...part, qty: 1 },
    }))
  }

  function updatePartQty(sku, qty) {
    setPartsCart((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        qty: Math.max(1, Number(qty) || 1),
      },
    }))
  }

  function removePart(sku) {
    setPartsCart((prev) => {
      const next = { ...prev }
      delete next[sku]
      return next
    })
  }

  function exportPartsQuote() {
    const rows = partsCartItems
      .map(
        (part) => `
          <tr>
            <td>${part.sku}</td>
            <td>${part.name}</td>
            <td>${part.qty}</td>
            <td>${money(part.price)}</td>
            <td>${money(part.price * part.qty)}</td>
          </tr>
        `
      )
      .join("")

    const html = `
      <html>
        <head>
          <title>INNOVA Parts Sales Quote</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 34px; color: #20242a; }
            .header { display:flex; justify-content:space-between; align-items:center; border-bottom:5px solid #00a651; padding-bottom:18px; margin-bottom:24px; }
            .logo { max-width:210px; max-height:85px; object-fit:contain; }
            h1 { margin:0 0 8px; font-size:30px; }
            .info { display:grid; grid-template-columns:1fr 1fr; gap:10px 40px; background:#f4f6f8; border:1px solid #d0d5dd; padding:16px; border-radius:10px; }
            table { width:100%; border-collapse:collapse; margin-top:22px; }
            th { background:#20242a; color:white; }
            th, td { border:1px solid #d0d5dd; padding:10px; text-align:left; }
            td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align:right; }
            .total { text-align:right; font-size:24px; font-weight:900; margin-top:18px; }
            .footer { margin-top:38px; padding-top:16px; border-top:1px solid #999; font-weight:900; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}${LOGO.replace("./", "/")}" class="logo" />
            <div>
              <h1>INNOVA Parts Sales Quote</h1>
              <div>Date: ${dealerInfo.date}</div>
            </div>
          </div>
          <div class="info">
            <div><strong>Dealer Name:</strong> ${dealerInfo.dealerName}</div>
            <div><strong>PO Number:</strong> ${dealerInfo.poNumber}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Part #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">No parts selected.</td></tr>'}
            </tbody>
          </table>
          <div class="total">Subtotal: ${money(partsSubtotal)}</div>
          <div class="footer">Shipping and applicable taxes not included. Quote is subject to final review and approval.</div>
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function buildQuoteHtml() {
    const logoForPdf = `${window.location.origin}${LOGO.replace("./", "/")}`
    const pdfSubtotal = getPdfSubtotal()

    const rows = quoteItems
      .map(
        (item) => `
          <tr>
            <td>${item.sku}</td>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>${money(getDisplayPrice(item, pricingView))}</td>
            <td>${money(getDisplayPrice(item, pricingView) * item.qty)}</td>
          </tr>
        `
      )
      .join("")

    const whiteGloveRow =
      pricingView === "whiteGlove"
        ? `
        <tr>
          <td>WGD</td>
          <td>White Glove Fee</td>
          <td>1</td>
          <td>${money(WHITE_GLOVE_FEE)}</td>
          <td>${money(WHITE_GLOVE_FEE)}</td>
        </tr>
      `
        : ""

    const customerRows =
      pricingView === "whiteGlove"
        ? `
          <div><strong>Customer Name:</strong> ${dealerInfo.customerName}</div>
          <div><strong>Customer Contact:</strong> ${dealerInfo.customerContact}</div>
          <div style="grid-column: 1 / -1;"><strong>Customer Address:</strong> ${dealerInfo.customerAddress}</div>
        `
        : ""

    return `
      <html>
        <head>
          <title>INNOVA ${pricingView === "whiteGlove" ? "White Glove Install" : "Dealer Install"} Quote</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 34px;
              color: #20242a;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 5px solid #00a651;
              padding-bottom: 18px;
              margin-bottom: 24px;
            }
            .logo {
              max-width: 210px;
              max-height: 85px;
              object-fit: contain;
            }
            .quote-title { text-align: right; }
            .quote-title h1 {
              margin: 0;
              font-size: 30px;
            }
            .badge {
              display: inline-block;
              margin-top: 8px;
              background: #20242a;
              color: white;
              padding: 6px 10px;
              border-radius: 999px;
              font-size: 12px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: .04em;
            }
            .dealer-box {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 40px;
              background: #f4f6f8;
              border: 1px solid #d0d5dd;
              padding: 16px;
              border-radius: 10px;
              margin-bottom: 24px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 18px;
            }
            th {
              background: #20242a;
              color: white;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: .04em;
            }
            th, td {
              border: 1px solid #d0d5dd;
              padding: 10px;
              text-align: left;
            }
            td:nth-child(3), td:nth-child(4), td:nth-child(5) {
              text-align: right;
            }
            tbody tr:nth-child(even) { background: #f9fafb; }
            .subtotal {
              text-align: right;
              font-size: 24px;
              font-weight: 900;
              margin-top: 18px;
            }
            .disclaimer {
              margin-top: 10px;
              color: #667085;
              font-size: 13px;
              text-align: right;
            }
            .notes {
              margin-top: 26px;
              border: 1px solid #d0d5dd;
              border-radius: 10px;
              padding: 14px;
              min-height: 75px;
              background: #fafafa;
            }
            .footer {
              margin-top: 38px;
              padding-top: 16px;
              border-top: 1px solid #999;
              font-weight: 900;
              color: #20242a;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <img src="${logoForPdf}" class="logo" />
            </div>
            <div class="quote-title">
              <h1>${pricingView === "whiteGlove" ? "White Glove Install Quote" : "Dealer Install Quote"}</h1>
              <div>Date: ${dealerInfo.date}</div>
              <div class="badge">
                ${pricingView === "whiteGlove" ? "White Glove Install Pricing" : "Dealer Install Pricing"}
              </div>
            </div>
          </div>

          <div class="dealer-box">
            <div><strong>Dealer Name:</strong> ${dealerInfo.dealerName}</div>
            <div><strong>PO Number:</strong> ${dealerInfo.poNumber}</div>
            ${customerRows}
          </div>

          <table>
            <thead>
              <tr>
                <th>Part #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || whiteGloveRow ? rows + whiteGloveRow : `<tr><td colspan="5">No items selected.</td></tr>`}
            </tbody>
          </table>

          <div class="subtotal">Subtotal: ${money(pdfSubtotal)}</div>

          <div class="disclaimer">
            Shipping and applicable taxes not included. Quote is subject to final review and approval.
          </div>

          <div class="notes">
            <strong>Notes:</strong><br />
            ${dealerInfo.notes}
          </div>

          <div class="footer">
            INNOVA Longarm — Quote Request
          </div>
        </body>
      </html>
    `
  }

  function saveQuote() {
    const html = buildQuoteHtml()
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  async function submitQuoteRequest() {
    if (!selectedMachine) return

    try {
      const html = buildQuoteHtml()

      const container = document.createElement("div")
      container.style.position = "fixed"
      container.style.left = "-100000px"
      container.style.top = "0"
      container.style.width = "1100px"
      container.style.background = "#ffffff"
      container.innerHTML = html.replace(/^.*?<body>/s, "").replace(/<\/body>.*$/s, "")
      document.body.appendChild(container)

      const pdfDataUri = await html2pdf()
        .set({
          margin: 0.35,
          filename: "INNOVA_Quote.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 1.5, useCORS: true },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(container)
        .outputPdf("datauristring")

      document.body.removeChild(container)

      const pdfBase64 = pdfDataUri.split(",")[1]

      const subject = `INNOVA ${
        pricingView === "whiteGlove" ? "White Glove Install" : "Dealer Install"
      } Quote Request - ${dealerInfo.dealerName || "Dealer"}`

      const emailBody = `
        <p>Hello,</p>
        <p>A new INNOVA quote has been submitted.</p>
        <p>
          <strong>Dealer Name:</strong> ${dealerInfo.dealerName || ""}<br>
          <strong>PO Number:</strong> ${dealerInfo.poNumber || ""}<br>
          <strong>Quote Type:</strong> ${
            pricingView === "whiteGlove" ? "White Glove Install" : "Dealer Install"
          }<br>
          ${
            pricingView === "whiteGlove"
              ? `<strong>Customer Name:</strong> ${dealerInfo.customerName || ""}<br>
                 <strong>Customer Address:</strong> ${dealerInfo.customerAddress || ""}<br>
                 <strong>Customer Contact:</strong> ${dealerInfo.customerContact || ""}<br>`
              : ""
          }
          <strong>Quote Subtotal:</strong> ${money(getPdfSubtotal())}
        </p>
        <p>The quote PDF is attached to this email.</p>
      `

      const response = await fetch("/api/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html: emailBody,
          pdfBase64,
          fileName: `INNOVA_Quote_${(dealerInfo.dealerName || "Dealer").replace(
            /[^a-z0-9_-]/gi,
            "_"
          )}.pdf`,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "The quote could not be sent.")
      }

      alert("Quote submitted successfully. The quote PDF has been emailed to the sales team.")
    } catch (error) {
      console.error("Quote submission failed:", error)
      alert(`Unable to submit the quote: ${error.message}`)
    }
  }

  function renderMachineCards() {
    const visibleGroups = Object.entries(machineGroups).filter(
      ([family, variants]) => {
        if (!searchTerm.trim()) return true

        const search = searchTerm.trim().toLowerCase()

        return (
          family.toLowerCase().includes(search) ||
          variants.some(
            (product) =>
              product.name.toLowerCase().includes(search) ||
              product.sku.toLowerCase().includes(search)
          )
        )
      }
    )

    return visibleGroups.map(([family, variants]) => {
      const selected = selectedMachine
        ? getMachineFamily(selectedMachine) === family
        : false

      const currentSize =
        machineSizes[family] || getMachineSize(variants[0]) || ""

      const selectedVariant =
        variants.find((product) => getMachineSize(product) === currentSize) ||
        variants[0]

      const sizes = ["5'", "8'", "10'", "11'", "12'"]
      const availableSizes = new Set(
        variants.map((product) => getMachineSize(product)).filter(Boolean)
      )

      return (
        <article
          key={family}
          className={`product-card machine-family-card ${
            selected ? "selected" : ""
          }`}
        >
          <div className="image-wrap">
            {selectedVariant.image ? (
              <img src={selectedVariant.image} alt={family} />
            ) : (
              <div className="missing-photo">Photo Coming Soon</div>
            )}
          </div>

          <div className="product-text">
            <div className="sku">
              {selectedVariant.sku === "N/A" ? "SKU: N/A" : "Machine"}
            </div>
            <h3>{family}</h3>

            <label
              className="machine-size-label"
              onClick={(e) => e.stopPropagation()}
            >
              Frame Size
              <select
                value={currentSize}
                onChange={(e) =>
                  handleMachineSizeChange(family, e.target.value)
                }
              >
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size} Frame
                  </option>
                ))}
              </select>
            </label>

            <div className="price">
              {money(getDisplayPrice(selectedVariant, pricingView))}
            </div>

          </div>

          <button
            className="add-button"
            onClick={() => selectMachine(selectedVariant)}
          >
            {selected ? "Selected" : "Select Machine"}
          </button>
        </article>
      )
    })
  }

  return (
    <div className={`app-shell ${themeMode === "dark" ? "dark-mode" : ""}`}>
      <header className="brand-header">
        <div className="brand-left">
          <img src={LOGO} alt="INNOVA" className="brand-logo" />
          <div>
            <h1>Build Your INNOVA Quote</h1>
            <p>Select a machine, add options, and save a quote PDF.</p>
          </div>
        </div>

        <div className="top-controls">
          <div className="toggle-group">
            <button
              className={pricingView === "wholesale" ? "active" : ""}
              onClick={() => { setActiveTab("order"); setPricingView("wholesale") }}
            >
              Dealer Install
            </button>

            <button
              className={pricingView === "whiteGlove" ? "active" : ""}
              onClick={() => { setActiveTab("order"); setPricingView("whiteGlove") }}
            >
              White Glove Install
            </button>
            <button
              className={activeTab === "parts" ? "active" : ""}
              onClick={() => setActiveTab("parts")}
            >
              Parts
            </button>
          </div>

          <div className="toggle-group">
            <button
              className={themeMode === "light" ? "active" : ""}
              onClick={() => setThemeMode("light")}
            >
              Light
            </button>

            <button
              className={themeMode === "dark" ? "active" : ""}
              onClick={() => setThemeMode("dark")}
            >
              Dark
            </button>
          </div>
        </div>
      </header>

      {activeTab === "parts" ? (
        <main
          className="parts-workspace"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 390px",
            gap: "24px",
            padding: "24px",
            alignItems: "start",
          }}
        >
          <section
            className="parts-catalog"
            style={{
              minWidth: 0,
              background: "var(--card-bg, #fff)",
              border: "1px solid var(--border, #d0d5dd)",
              borderRadius: "18px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "end",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Parts</h2>
                <span style={{ opacity: 0.7 }}>
                  {filteredParts.length.toLocaleString()} parts available
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <input
                type="text"
                value={partsSearch}
                onChange={(e) => setPartsSearch(e.target.value)}
                placeholder="Search by part number or product name..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border, #d0d5dd)",
                  background: "var(--input-bg, #fff)",
                  color: "inherit",
                  fontSize: "15px",
                }}
              />
              {partsSearch && (
                <button onClick={() => setPartsSearch("")}>Clear</button>
              )}
            </div>

            <div
              className="parts-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(245px, 1fr))",
                gap: "16px",
              }}
            >
              {filteredParts.map((part) => {
                const inCart = Boolean(partsCart[part.sku])

                return (
                  <article
                    key={part.sku}
                    className={`part-card ${inCart ? "selected" : ""}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "165px",
                      padding: "18px",
                      borderRadius: "16px",
                      border: "1px solid var(--border, #d0d5dd)",
                      background: "var(--soft-bg, #f8fafc)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 900,
                            letterSpacing: ".04em",
                            opacity: 0.7,
                          }}
                        >
                          {part.sku}
                        </span>
                        {inCart && (
                          <span style={{ fontSize: "12px", fontWeight: 800 }}>
                            Added
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: "12px 0 18px", lineHeight: 1.3 }}>
                        {part.name}
                      </h3>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <strong style={{ fontSize: "18px" }}>
                        {money(part.price)}
                      </strong>

                      <button
                        className="add-button"
                        onClick={() => addPart(part)}
                      >
                        {inCart ? "Add Another" : "Add to Parts Quote"}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {filteredParts.length === 0 && (
              <div
                style={{
                  padding: "50px 20px",
                  textAlign: "center",
                  opacity: 0.7,
                }}
              >
                No parts found. Try searching by a different part number or
                product name.
              </div>
            )}
          </section>

          <aside
            className="parts-quote-sidebar quote-sidebar"
            style={{ position: "sticky", top: "24px" }}
          >
            <div className="quote-top">
              <h2>Parts Quote</h2>
              <p>Dealer parts pricing.</p>
            </div>

            <div className="quote-lines">
              {partsCartItems.length === 0 ? (
                <div className="empty-cart">
                  Search for a part and add it to your quote.
                </div>
              ) : (
                partsCartItems.map((part) => (
                  <div className="quote-line" key={part.sku}>
                    <div>
                      <div className="quote-sku">{part.sku}</div>
                      <div className="quote-name">{part.name}</div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: "8px",
                        }}
                      >
                        <span>Qty</span>
                        <input
                          type="number"
                          min="1"
                          value={part.qty}
                          onChange={(e) =>
                            updatePartQty(part.sku, e.target.value)
                          }
                          style={{ width: "60px" }}
                        />
                      </div>
                    </div>

                    <div className="quote-right">
                      <strong>{money(part.price * part.qty)}</strong>
                      <button onClick={() => removePart(part.sku)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="quote-bottom">
              <div className="subtotal">
                <span>Subtotal</span>
                <strong>{money(partsSubtotal)}</strong>
              </div>

              <p>Shipping and applicable taxes not included.</p>

              <button
                className="save-button wholesale-button"
                onClick={exportPartsQuote}
                disabled={partsCartItems.length === 0}
              >
                Export Sales Quote
              </button>
            </div>
          </aside>
        </main>
      ) : (
      <main className="main-layout">
        <nav className="category-sidebar">
          <h3>Categories</h3>

          {Object.keys(categories).map((category) => (
            <button
              key={category}
              onClick={() => {
                document
                  .getElementById(`category-${slugify(category)}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            >
              {category}
            </button>
          ))}
        </nav>

        <section className="catalog-area">
          <section className="dealer-card">
            <h2>
              {pricingView === "whiteGlove"
                ? "Order Information"
                : "Dealer Information"}
            </h2>

            <div className="dealer-grid">
              <label>
                Date
                <input
                  type="date"
                  value={dealerInfo.date}
                  onChange={(e) =>
                    setDealerInfo({ ...dealerInfo, date: e.target.value })
                  }
                />
              </label>

              <label>
                Dealer Name
                <input
                  value={dealerInfo.dealerName}
                  onChange={(e) =>
                    setDealerInfo({ ...dealerInfo, dealerName: e.target.value })
                  }
                />
              </label>

              <label>
                PO Number
                <input
                  value={dealerInfo.poNumber}
                  onChange={(e) =>
                    setDealerInfo({ ...dealerInfo, poNumber: e.target.value })
                  }
                />
              </label>

              {pricingView === "whiteGlove" && (
                <>
                  <label>
                    Customer Name
                    <input
                      value={dealerInfo.customerName}
                      onChange={(e) =>
                        setDealerInfo({
                          ...dealerInfo,
                          customerName: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Customer Address
                    <input
                      value={dealerInfo.customerAddress}
                      onChange={(e) =>
                        setDealerInfo({
                          ...dealerInfo,
                          customerAddress: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Customer Contact
                    <input
                      value={dealerInfo.customerContact}
                      onChange={(e) =>
                        setDealerInfo({
                          ...dealerInfo,
                          customerContact: e.target.value,
                        })
                      }
                    />
                  </label>
                </>
              )}

              <label className="notes-field">
                Notes
                <textarea
                  value={dealerInfo.notes}
                  onChange={(e) =>
                    setDealerInfo({ ...dealerInfo, notes: e.target.value })
                  }
                />
              </label>
            </div>
          </section>

          <div className="search-card">
            <input
              type="text"
              placeholder="Search by product name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchTerm && (
              <button onClick={() => setSearchTerm("")}>Clear</button>
            )}
          </div>

          {Object.entries(filteredCategories).map(([category, items]) => (
            <section
              key={category}
              id={`category-${slugify(category)}`}
              className={`category-section ${
                category === "Machine" ? "machine-section" : ""
              }`}
            >
              <div className="category-header">
                <h2>{category}</h2>
                {category === "Machine" && (
                  <span>Required: select one</span>
                )}
              </div>

              {category === "Machine" ? (
                <div className="product-grid">{renderMachineCards()}</div>
              ) : (
                <div className="product-grid">
                  {items.map((product) => {
                    const selected = Boolean(selectedItems[product.sku])

                    return (
                      <article
                        key={product.sku}
                        className={`product-card ${selected ? "selected" : ""}`}
                        onClick={() => toggleProduct(product)}
                      >
                        <div className="image-wrap">
                          {product.image ? (
                            <img src={product.image} alt={product.name} />
                          ) : (
                            <div className="missing-photo">
                              Photo Coming Soon
                            </div>
                          )}
                        </div>

                        <div className="product-text">
                          <div className="sku">{product.sku}</div>
                          <h3>{product.name}</h3>
                          <div className="price">
                            {money(getDisplayPrice(product, pricingView))}
                          </div>
                        </div>

                        <button className="add-button">
                          {selected ? "Added to Quote" : "Add to Quote"}
                        </button>

                        {product.selectionType === "optional-quantity" &&
                          selectedItems[product.sku] && (
                            <div
                              className="qty-control"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>Qty</span>
                              <input
                                type="number"
                                min="1"
                                value={selectedItems[product.sku].qty}
                                onChange={(e) =>
                                  updateQty(product.sku, e.target.value)
                                }
                              />
                            </div>
                          )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </section>

        <aside className="quote-sidebar">
          <div className="quote-top">
            <h2>Quote Builder</h2>
          </div>

          <div className="quote-lines">
            {recommendations.map((recommendation) => (
              <div className="recommendation-card" key={recommendation.id}>
                <div className="recommendation-label">Recommended Add-On</div>
                <strong>{recommendation.title}</strong>
                <p>{recommendation.description}</p>
                <button onClick={() => toggleProduct(recommendation.product)}>
                  Add {recommendation.title}
                </button>
              </div>
            ))}

            {quoteItems.length === 0 ? (
              <div className="empty-cart">Select one machine to begin.</div>
            ) : (
              <>
                {quoteItems.map((item) => (
                  <div className="quote-line" key={item.sku}>
                    <div>
                      <div className="quote-sku">{item.sku}</div>
                      <div className="quote-name">{item.name}</div>
                      <div className="quote-qty">Qty: {item.qty}</div>
                    </div>

                    <div className="quote-right">
                      <strong>
                        {money(
                          getDisplayPrice(item, pricingView) * item.qty
                        )}
                      </strong>
                      <button onClick={() => removeItem(item.sku)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {pricingView === "whiteGlove" ? (
                  <div className="quote-line" key="white-glove">
                    <div>
                      <div className="quote-sku">WGD</div>
                      <div className="quote-name">White Glove Fee</div>
                    </div>
                    <div className="quote-right">
                      <strong>{money(WHITE_GLOVE_FEE)}</strong>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="quote-bottom">
            <div className="subtotal">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>

            <p>Shipping and applicable taxes not included.</p>

            <button
              className="save-button wholesale-button"
              onClick={() => saveQuote()}
              disabled={!selectedMachine}
            >
              {pricingView === "whiteGlove"
                ? "Download White Glove Quote"
                : "Download Wholesale Dealer Quote"}
            </button>

            <button
              className="submit-button"
              onClick={submitQuoteRequest}
              disabled={!selectedMachine}
            >
              Submit Quote Request
            </button>
          </div>
        </aside>
      </main>
      )}
    </div>
  )
}

export default App
