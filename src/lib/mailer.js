const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../logger');

let transport = null;

if (config.mail.host) {
  transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user
      ? { user: config.mail.user, pass: config.mail.password }
      : undefined,
  });
}

/**
 * Envia e-mail via SMTP quando SMTP_HOST está configurado.
 * Sem SMTP (dev/test), apenas loga o conteúdo — nenhum e-mail sai.
 */
async function sendMail({ to, subject, text, html }) {
  if (!transport) {
    logger.info({ event: 'mailer.devLog', to, subject, text });
    return { delivered: false, logged: true };
  }

  const info = await transport.sendMail({
    from: config.mail.from,
    to,
    subject,
    text,
    html,
  });
  logger.info({ event: 'mailer.sent', to, subject, messageId: info.messageId });
  return { delivered: true, messageId: info.messageId };
}

module.exports = { sendMail };
