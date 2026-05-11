import { useMemo, useState } from "react"
import "./App.css"
import products from "./data/products"

const LOGO = "/photos/innova-logo.png"

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0)
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function getRetailPrice(product) {
  const name = product.name.toLowerCase()

  if (product.category === "Machine") {
    if (name.includes("m20") && name.includes("autopilot")) return 40999
    if (name.includes("m20")) return 22999

    if (name.includes("m24") && name.includes("autopilot")) return 46999
    if (name.includes("m24")) return 28999

    if (name.includes("m28")) return 52999
  }

  return product.price / 0.6  
}

function getWholesalePrice(product) {
  return product.price
}

function getDisplayPrice(product, priceMode) {
  return priceMode === "retail"
    ? getRetailPrice(product)
    : getWholesalePrice(product)
}

function App() {
  const [dealerInfo, setDealerInfo] = useState({
    date: new Date().toISOString().slice(0, 10),
    dealerName: "",
    poNumber: "",
    notes: "",
  })

  const [selectedMachine, setSelectedMachine] = useState(null)
  const [selectedItems, setSelectedItems] = useState({})
  const [searchTerm, setSearchTerm] = useState("")
  const [priceMode, setPriceMode] = useState("retail")
  const [themeMode, setThemeMode] = useState("light")

  const categories = useMemo(() => {
    const grouped = {}

    products.forEach((product) => {
      if (!grouped[product.category]) grouped[product.category] = []
      grouped[product.category].push(product)
    })

    return grouped
  }, [])

  const filteredCategories = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    if (!search) return categories

    const filtered = {}

    Object.entries(categories).forEach(([category, items]) => {
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

  const subtotal = quoteItems.reduce(
    (total, item) => total + getDisplayPrice(item, priceMode) * item.qty,
    0
  )

  const keyboardTray = products.find((p) => p.sku === "ACC1064")

  const shouldSuggestKeyboardTray =
    selectedMachine?.name?.toLowerCase().includes("autopilot") &&
    keyboardTray &&
    !selectedItems[keyboardTray.sku]

  function toggleProduct(product) {
    if (product.selectionType === "required-single") {
      setSelectedMachine(product)

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

  function getPdfSubtotal(pdfMode) {
    return quoteItems.reduce(
      (total, item) => total + getDisplayPrice(item, pdfMode) * item.qty,
      0
    )
  }

  function saveQuote(pdfMode = priceMode) {
    const logoForPdf = `${window.location.origin}${LOGO.replace("./", "/")}`
    const pdfSubtotal = getPdfSubtotal(pdfMode)

    const rows = quoteItems
      .map(
        (item) => `
          <tr>
            <td>${item.sku}</td>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>${money(getDisplayPrice(item, pdfMode))}</td>
            <td>${money(getDisplayPrice(item, pdfMode) * item.qty)}</td>
          </tr>
        `
      )
      .join("")

    const quoteTitle =
      pdfMode === "retail" ? "Customer Quote" : "Dealer Quote Request"

    const footerText =
      pdfMode === "retail"
        ? "Quote provided by your authorized INNOVA dealer. Shipping and applicable taxes not included."
        : "Please save this quote and e-mail to sales@abminternational.com."

    const modeBadge =
      pdfMode === "retail" ? "Retail Customer Pricing" : "Wholesale Dealer Pricing"

    const html = `
      <html>
        <head>
          <title>INNOVA ${quoteTitle}</title>
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

            .quote-title {
              text-align: right;
            }

            .quote-title h1 {
              margin: 0;
              font-size: 30px;
            }

            .badge {
              display: inline-block;
              margin-top: 8px;
              background: ${pdfMode === "retail" ? "#00a651" : "#20242a"};
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

            td:nth-child(3),
            td:nth-child(4),
            td:nth-child(5) {
              text-align: right;
            }

            tbody tr:nth-child(even) {
              background: #f9fafb;
            }

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
              <h1>${quoteTitle}</h1>
              <div>Date: ${dealerInfo.date}</div>
              <div class="badge">${modeBadge}</div>
            </div>
          </div>

          <div class="dealer-box">
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
              ${rows || `<tr><td colspan="5">No items selected.</td></tr>`}
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
            ${footerText}
          </div>
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank")
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function submitQuoteRequest() {
    saveQuote("wholesale")

    const subject = encodeURIComponent(
      `INNOVA Quote Request - ${dealerInfo.dealerName || "Dealer"}`
    )

    const body = encodeURIComponent(
`Hello,

Please see the attached INNOVA wholesale dealer quote request.

Dealer Name: ${dealerInfo.dealerName}
PO Number: ${dealerInfo.poNumber}
Quote Subtotal: ${money(getPdfSubtotal("wholesale"))}

Please save the generated PDF quote and attach it to this email before sending.

Thank you.`
    )

    window.location.href =
      `mailto:sales@abminternational.com?subject=${subject}&body=${body}`
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
              className={priceMode === "retail" ? "active" : ""}
              onClick={() => setPriceMode("retail")}
            >
              Retail View
            </button>

            <button
              className={priceMode === "wholesale" ? "active" : ""}
              onClick={() => setPriceMode("wholesale")}
            >
              Wholesale View
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
            <h2>Dealer Information</h2>

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
                {category === "Machine" && <span>Required: select one</span>}
              </div>

              <div className="product-grid">
                {(category === "Machine" && selectedMachine && !searchTerm
                  ? [selectedMachine]
                  : items
                ).map((product) => {
                  const selected =
                    selectedMachine?.sku === product.sku ||
                    Boolean(selectedItems[product.sku])

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
                          <div className="missing-photo">Photo Coming Soon</div>
                        )}
                      </div>

                      <div className="product-text">
                        <div className="sku">{product.sku}</div>
                        <h3>{product.name}</h3>
                        <div className="price">
                          {money(getDisplayPrice(product, priceMode))}
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
            </section>
          ))}
        </section>

        <aside className="quote-sidebar">
          <div className="quote-top">
            <h2>Quote Builder</h2>
            <p>
              {priceMode === "retail"
                ? "Retail customer pricing view."
                : "Wholesale dealer pricing view."}
            </p>
          </div>

          <div className="quote-lines">
            {shouldSuggestKeyboardTray && (
              <div className="recommendation-card">
                <div className="recommendation-label">Recommended Add-On</div>
                <strong>Don&apos;t forget the Keyboard and Mouse Tray!</strong>
                <p>This is commonly added with AutoPilot packages.</p>
                <button onClick={() => toggleProduct(keyboardTray)}>
                  Add Keyboard and Mouse Tray
                </button>
              </div>
            )}

            {quoteItems.length === 0 ? (
              <div className="empty-cart">Select one machine to begin.</div>
            ) : (
              quoteItems.map((item) => (
                <div className="quote-line" key={item.sku}>
                  <div>
                    <div className="quote-sku">{item.sku}</div>
                    <div className="quote-name">{item.name}</div>
                    <div className="quote-qty">Qty: {item.qty}</div>
                  </div>

                  <div className="quote-right">
                    <strong>
                      {money(getDisplayPrice(item, priceMode) * item.qty)}
                    </strong>
                    <button onClick={() => removeItem(item.sku)}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="quote-bottom">
            <div className="subtotal">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>

            <p>Shipping and applicable taxes not included.</p>

            <button
              className="save-button"
              onClick={() => saveQuote("retail")}
              disabled={!selectedMachine}
            >
              Download Retail Customer Quote
            </button>

            <button
              className="save-button wholesale-button"
              onClick={() => saveQuote("wholesale")}
              disabled={!selectedMachine}
            >
              Download Wholesale Dealer Quote
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
    </div>
  )
}

export default App