import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, resolvePhotoUrl } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import { getRoleLabel } from '../../utils/helpers';
import monkeyDefault from '../../assets/monkey.jpeg';
import '../../css/messagerie.css';

export default function AdminMessagerie() {
  const { user, API_BASE } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState(null);
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);
  const activeIdRef = useRef(null);

  const currentUserId = Number(user?.id);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Clic en dehors → fermer les actions
  useEffect(() => {
    const handleClick = () => setSelectedMsgId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ══════════════════════════════════════════════
  //  1. Charger la liste des conversations
  // ══════════════════════════════════════════════
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const [usersRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/utilisateurs`).then(r => r.json()),
        fetch(`${API_BASE}/messages/summary?userId=${currentUserId}`).then(r => r.json()),
      ]);

      const allUsers = Array.isArray(usersRes) ? usersRes : [];
      const summaries = Array.isArray(summaryRes) ? summaryRes : [];
      const summaryMap = {};
      for (const s of summaries) summaryMap[s.other_user_id] = s;

      const convs = allUsers
        .filter(u => Number(u.id) !== currentUserId)
        .map(u => {
          const summary = summaryMap[u.id];
          return {
            id: Number(u.id),
            name: u.nom,
            role: u.role,
            avatar: resolvePhotoUrl(u.photo_url),
            lastMessage: summary?.last_text || 'Aucun message',
            lastDate: summary?.last_date || null,
            unread: Number(summary?.unread_count) || 0,
          };
        })
        .sort((a, b) => {
          if (a.lastDate && b.lastDate) return new Date(b.lastDate) - new Date(a.lastDate);
          if (a.lastDate) return -1;
          if (b.lastDate) return 1;
          return 0;
        });

      const currentActive = activeIdRef.current;
      setConversations(currentActive
        ? convs.map(c => c.id === currentActive ? { ...c, unread: 0 } : c)
        : convs
      );
    } catch { /* silently fail */ }
  }, [API_BASE, currentUserId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (activeId === null && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // ══════════════════════════════════════════════
  //  2. Socket.io : temps reel
  // ══════════════════════════════════════════════
  useEffect(() => {
    if (!currentUserId) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('user:join', currentUserId);

    const handleReceive = (msg) => {
      if (!msg || Number(msg.destinataire_id) !== currentUserId) return;
      const fromId = Number(msg.expediteur_id);

      if (fromId === activeIdRef.current) {
        setMessages(prev => [...prev, {
          id: msg.id,
          expediteur_id: fromId,
          destinataire_id: currentUserId,
          text: msg.contenu,
          time: new Date(msg.date_envoi || Date.now())
            .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          modifie: Number(msg.modifie) === 1,
        }]);
        fetch(`${API_BASE}/messages/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromUserId: fromId, toUserId: currentUserId }),
        }).then(() => {
          window.dispatchEvent(new CustomEvent('unread-update'));
        });
      } else {
        setConversations(prev => prev.map(c =>
          c.id === fromId
            ? { ...c, unread: (c.unread || 0) + 1, lastMessage: msg.contenu, lastDate: new Date().toISOString() }
            : c
        ));
      }
    };

    const handleConvUpdate = () => loadConversations();

    const handleEdited = (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.id ? { ...m, text: data.contenu, modifie: true } : m
      ));
    };

    const handleDeleted = (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.id));
      loadConversations();
    };

    socket.on('message:receive', handleReceive);
    socket.on('conversations:update', handleConvUpdate);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);

    return () => {
      socket.off('message:receive', handleReceive);
      socket.off('conversations:update', handleConvUpdate);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
    };
  }, [currentUserId, API_BASE, loadConversations]);

  // Polling de secours (15s)
  useEffect(() => {
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // ══════════════════════════════════════════════
  //  3. Charger les messages (donnees brutes)
  // ══════════════════════════════════════════════
  useEffect(() => {
    if (!activeId || !currentUserId) return;
    fetch(`${API_BASE}/messages?user1=${currentUserId}&user2=${activeId}`)
      .then(r => r.json())
      .then(data => {
        setMessages((Array.isArray(data) ? data : []).map(m => ({
          id: m.id,
          expediteur_id: Number(m.expediteur_id),
          destinataire_id: Number(m.destinataire_id),
          text: m.contenu,
          time: new Date(m.date_envoi).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          modifie: Number(m.modifie) === 1,
        })));
      })
      .catch(() => setMessages([]));
  }, [activeId, currentUserId, API_BASE]);

  // ══════════════════════════════════════════════
  //  4. Marquer comme lu (optimiste)
  // ══════════════════════════════════════════════
  useEffect(() => {
    if (!activeId || !currentUserId) return;

    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, unread: 0 } : c
    ));

    fetch(`${API_BASE}/messages/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId: activeId, toUserId: currentUserId }),
    }).then(() => {
      window.dispatchEvent(new CustomEvent('unread-update'));
    }).catch(() => {});
  }, [activeId, currentUserId, API_BASE]);

  // Scroll en bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ══════════════════════════════════════════════
  //  5. Envoyer un message
  // ══════════════════════════════════════════════
  const sendMessage = async () => {
    if (!messageText.trim() || !activeId) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expediteur_id: currentUserId, destinataire_id: activeId, contenu: messageText }),
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => [...prev, {
          id: saved.id,
          expediteur_id: currentUserId,
          destinataire_id: activeId,
          text: messageText,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          modifie: false,
        }]);
        setMessageText('');
        setConversations(prev => prev.map(c =>
          c.id === activeId ? { ...c, lastMessage: messageText, lastDate: new Date().toISOString() } : c
        ));
        const socket = getSocket();
        socket.emit('message:send', saved);
      }
    } catch { alert('Erreur lors de l\'envoi.'); }
  };

  // ══════════════════════════════════════════════
  //  6. Supprimer un message
  // ══════════════════════════════════════════════
  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };

  const deleteMessage = async (msg) => {
    // Optimistic: retire immédiatement du state
    const previousMessages = [...messages];
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setSelectedMsgId(null);

    try {
      const url = `${API_BASE}/messages/${msg.id}?expediteur_id=${msg.expediteur_id}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expediteur_id: msg.expediteur_id }),
      });
      if (res.ok) {
        loadConversations();
        const socket = getSocket();
        socket.emit('message:delete', {
          id: msg.id,
          expediteur_id: msg.expediteur_id,
          destinataire_id: msg.destinataire_id,
        });
      } else {
        // Erreur serveur → restaurer le message
        setMessages(previousMessages);
        showToast('Suppression impossible');
      }
    } catch {
      // Erreur réseau → restaurer le message
      setMessages(previousMessages);
      showToast('Suppression impossible');
    }
  };

  // ══════════════════════════════════════════════
  //  7. Modifier un message
  // ══════════════════════════════════════════════
  const openEditModal = (msg) => {
    setEditingMsg(msg);
    setEditText(msg.text);
    setSelectedMsgId(null);
  };

  const submitEdit = async () => {
    if (!editText.trim() || !editingMsg) return;
    try {
      const url = `${API_BASE}/messages/${editingMsg.id}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu: editText, expediteur_id: editingMsg.expediteur_id }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages(prev => prev.map(m =>
          m.id === editingMsg.id ? { ...m, text: editText, modifie: true } : m
        ));
        setEditingMsg(null);
        setEditText('');
        loadConversations();
        const socket = getSocket();
        socket.emit('message:edit', {
          id: updated.id,
          contenu: editText,
          expediteur_id: editingMsg.expediteur_id,
          destinataire_id: editingMsg.destinataire_id,
        });
      } else {
        const text = await res.text();
        console.error('PUT error:', res.status, text);
        alert(`Erreur ${res.status}: ${text}`);
      }
    } catch (err) {
      console.error('PUT network error:', err);
      alert('Erreur réseau lors de la modification.');
    }
  };

  // Clic sur une bulle → toggle les actions
  const toggleMsgActions = (e, msgId) => {
    e.stopPropagation();
    setSelectedMsgId(prev => prev === msgId ? null : msgId);
  };

  const activeConv = conversations.find(c => c.id === activeId);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
  const filteredConvs = conversations.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="messagerie-container">
      <div className="messages-list">
        <div className="messages-header">
          <h2>Messages</h2>
          {totalUnread > 0 && <span className="total-unread-badge">{totalUnread} non lu{totalUnread > 1 ? 's' : ''}</span>}
        </div>
        <input className="conversation-search" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        {filteredConvs.map(c => (
          <div
            key={c.id}
            className={`conversation-item${c.id === activeId ? ' active' : ''}${c.unread > 0 ? ' has-unread' : ''}`}
            onClick={() => setActiveId(c.id)}
          >
            <div className="avatar-img">
              <img src={c.avatar} alt={c.name} />
              {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
            </div>
            <div className="message-info">
              <div className="message-header">
                <span className={`sender-name${c.unread > 0 ? ' unread' : ''}`}>{c.name}</span>
              </div>
              <span className="sender-role">{getRoleLabel(c.role)}</span>
              <div className={`message-preview${c.unread > 0 ? ' unread' : ''}`}>{c.lastMessage}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="message-content">
        <div className="chat-header">
          <img src={activeConv?.avatar || monkeyDefault} alt="" />
          <div className="recipient-info">
            <span className="recipient-name">{activeConv?.name || 'Sélectionnez une conversation'}</span>
            <span className="recipient-role">{activeConv?.role || ''}</span>
          </div>
        </div>

        <div className="conversation-messages">
          {messages.length === 0 ? (
            <div className="empty-thread">Aucun message pour le moment.</div>
          ) : messages.map((msg, i) => {
            const isMine = Number(msg.expediteur_id) === currentUserId;
            const isSelected = selectedMsgId === msg.id;
            return (
              <div key={msg.id || i} className={`message-row ${isMine ? 'me' : 'other'}`}>
                <div
                  className={`message-bubble${isSelected ? ' selected' : ''}`}
                  onClick={isMine ? (e) => toggleMsgActions(e, msg.id) : undefined}
                  style={isMine ? { cursor: 'pointer' } : undefined}
                >
                  {msg.text}
                  <div className="message-meta">
                    {msg.modifie === true && <span className="edited-label">modifié</span>}
                    <span className="message-time">{msg.time}</span>
                  </div>
                </div>
                {isMine && isSelected && (
                  <div className="msg-actions-popup" onClick={e => e.stopPropagation()}>
                    <button className="msg-popup-btn edit" onClick={() => openEditModal(msg)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Modifier
                    </button>
                    <button className="msg-popup-btn delete" onClick={() => deleteMessage(msg)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="reply-box">
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder="Écrire un message..."
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button className="send-btn" onClick={sendMessage}>Envoyer</button>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <div className="msg-toast">{toast}</div>}

      {/* Modal de modification */}
      {editingMsg && (
        <div className="edit-modal-overlay" onClick={() => setEditingMsg(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <h3>Modifier le message</h3>
            <textarea
              className="edit-modal-textarea"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); } }}
              autoFocus
            />
            <div className="edit-modal-actions">
              <button className="edit-modal-cancel" onClick={() => setEditingMsg(null)}>Annuler</button>
              <button className="edit-modal-save" onClick={submitEdit}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
