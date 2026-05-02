const makeWASocket = require("@whiskeysockets/baileys").default
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) startBot()
    }

    if (connection === "open") {
      console.log("✅ Bot online")
    }
  })

  // Boas-vindas e saída
  sock.ev.on("group-participants.update", async (data) => {
    const { id, participants, action } = data

    for (let user of participants) {
      if (action === "add") {
        await sock.sendMessage(id, {
          text: `👋 Bem-vindo @${user.split("@")[0]}`,
          mentions: [user]
        })
      }

      if (action === "remove") {
        await sock.sendMessage(id, {
          text: `😢 Saiu @${user.split("@")[0]}`,
          mentions: [user]
        })
      }
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m.message) return

    const from = m.key.remoteJid
    const sender = m.key.participant || from

    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      ""

    if (!text) return

    const isGroup = from.endsWith("@g.us")

    // 🚫 Anti-link
    if (isGroup && text.includes("http")) {
      await sock.sendMessage(from, { text: "🚫 Link proibido!" })
      await sock.groupParticipantsUpdate(from, [sender], "remove")
    }

    // ⚙️ Comandos
    if (text === "!ping") {
      await sock.sendMessage(from, { text: "🏓 pong" })
    }

    if (text === "!menu") {
      await sock.sendMessage(from, {
        text: `📋 MENU

!ping
!menu
!tagall
!fechar
!abrir`
      })
    }

    if (text === "!tagall" && isGroup) {
      const metadata = await sock.groupMetadata(from)
      const members = metadata.participants.map(p => p.id)

      await sock.sendMessage(from, {
        text: "📢 Marcando todos",
        mentions: members
      })
    }

    if (text === "!fechar" && isGroup) {
      await sock.groupSettingUpdate(from, "announcement")
    }

    if (text === "!abrir" && isGroup) {
      await sock.groupSettingUpdate(from, "not_announcement")
    }

    // 🤖 Resposta automática
    if (text.toLowerCase().includes("oi")) {
      await sock.sendMessage(from, { text: "Fala 👋" })
    }
  })
}

startBot()
