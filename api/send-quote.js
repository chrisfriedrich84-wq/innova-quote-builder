export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const {
      subject,
      html,
      pdfBase64,
      fileName,
      dealerEmail,
      dealerName,
      poNumber,
    } = req.body || {}

    if (!pdfBase64) {
      return res.status(400).json({
        error: "PDF attachment is missing.",
      })
    }

    if (!dealerEmail) {
      return res.status(400).json({
        error: "Dealer email is required.",
      })
    }

    const salesRecipients = [
      "sales@abminternational.com",
      "vince.nutt@abminternational.com",
      "ryan@abminternational.com",
      "krystal@abminternational.com",
      "cheyenne@abminternational.com",
      "randy.veldman@abminternational.com",
    ]

    const attachment = {
      filename: fileName || "INNOVA_Order.pdf",
      content: pdfBase64,
    }

    // Send the order to the INNOVA sales team.
    const salesResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "INNOVA Quote Builder <quotes@innovalongarm.com>",
        to: salesRecipients,
        subject:
          subject ||
          `INNOVA Order Request — ${dealerName || "Dealer"}${
            poNumber ? ` — PO ${poNumber}` : ""
          }`,
        html:
          html ||
          "<p>A new INNOVA order has been submitted. The order PDF is attached.</p>",
        attachments: [attachment],
      }),
    })

    const salesResult = await salesResponse.json()

    if (!salesResponse.ok) {
      console.error("Sales email error:", salesResult)

      return res.status(salesResponse.status).json({
        error:
          salesResult?.message ||
          "The order could not be sent to the sales team.",
      })
    }

    // Send a separate confirmation to the dealer.
    const dealerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "INNOVA Quote Builder <quotes@innovalongarm.com>",
        to: [dealerEmail],
        subject:
          `INNOVA Order Confirmation — ${dealerName || "Dealer"}${
            poNumber ? ` — PO ${poNumber}` : ""
          }`,
        html: `
          <p>Hello${dealerName ? ` ${dealerName}` : ""},</p>

          <p>
            Thank you for submitting your INNOVA order.
            Your order has been successfully sent to the INNOVA sales team
            for review.
          </p>

          <p>
            <strong>Dealer:</strong> ${dealerName || ""}<br>
            <strong>PO Number:</strong> ${poNumber || "N/A"}
          </p>

          <p>
            A copy of the order you submitted is attached to this email
            for your records.
          </p>

          <p>
            Thank you,<br>
            <strong>INNOVA Longarm</strong>
          </p>
        `,
        attachments: [attachment],
      }),
    })

    const dealerResult = await dealerResponse.json()

    if (!dealerResponse.ok) {
      console.error("Dealer confirmation error:", dealerResult)

      // The sales team received the order successfully, so report the
      // confirmation failure separately.
      return res.status(200).json({
        success: true,
        salesEmailSent: true,
        dealerConfirmationSent: false,
        warning:
          dealerResult?.message ||
          "Order was sent to sales, but the dealer confirmation email failed.",
      })
    }

    return res.status(200).json({
      success: true,
      salesEmailSent: true,
      dealerConfirmationSent: true,
      salesEmailId: salesResult.id,
      dealerConfirmationId: dealerResult.id,
    })
  } catch (error) {
    console.error("Send quote error:", error)

    return res.status(500).json({
      error: error.message || "Unable to send order.",
    })
  }
}
