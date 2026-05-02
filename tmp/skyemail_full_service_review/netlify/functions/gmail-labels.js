const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const data = await gmailRequest(accessToken, '/labels');
    const items = (data.labels || []).map((label) => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: Number(label.messagesTotal || 0),
      messagesUnread: Number(label.messagesUnread || 0),
      threadsTotal: Number(label.threadsTotal || 0),
      threadsUnread: Number(label.threadsUnread || 0),
      labelListVisibility: label.labelListVisibility || null,
      messageListVisibility: label.messageListVisibility || null,
      color: label.color || null,
    })).sort((a,b)=>{
      const system = ['INBOX','SENT','DRAFT','SPAM','TRASH','STARRED','IMPORTANT'];
      const ai = system.indexOf(a.id);
      const bi = system.indexOf(b.id);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return json(200, { ok:true, mailbox: mailbox.google_email, items });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
