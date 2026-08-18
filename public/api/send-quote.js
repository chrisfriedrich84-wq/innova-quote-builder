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
    } = req.body || {}

    if (!pdfBase64) {
      return res.status(400).json({ error: "PDF attachment is missing." })
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "INNOVA Quote Builder <quotes@innovalongarm.com>",
        to: ["sales@abminternational.com"],
        subject: subject || "INNOVA Quote Request",
        html:
          html ||
          "<p>A new INNOVA quote has been submitted. The quote PDF is attached.</p>",
        attachments: [
          {
            filename: fileName || "INNOVA_Quote.pdf",
            content: pdfBase64,
          },
        ],
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("Resend error:", result)

      return res.status(response.status).json({
        error: result?.message || "Resend failed to send the email.",
      })
    }

    return res.status(200).json({
      success: true,
      id: result.id,
    })
  } catch (error) {
    console.error("Send quote error:", error)

    return res.status(500).json({
      error: error.message || "Unable to send quote.",
    })
  }
}
