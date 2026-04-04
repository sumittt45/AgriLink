import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import AuthGuard from "@/components/agrilink/AuthGuard";
import { formatOrderDate } from "@/lib/formatTime";

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface ConversationMeta {
  id: string;
  otherName: string;
  otherImage: string | null;
}

const ChatPageContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get("id") || "";
  const { user } = useAuth();

  const [meta, setMeta]       = useState<ConversationMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody]         = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef               = useRef<HTMLDivElement>(null);

  // ── Fetch conversation metadata (other party's name + image) ──
  const fetchMeta = useCallback(async () => {
    if (!conversationId || !user) return;

    const { data: conv } = await supabase
      .from("conversations")
      .select("id, buyer_id, farmer_id, farmers(farm_name, profile_image_url, user_id), profiles:buyer_id(name, avatar_url)")
      .eq("id", conversationId)
      .single() as any;

    if (!conv) return;

    const isBuyer = conv.buyer_id === user.id;
    if (isBuyer) {
      // Other party is the farmer
      setMeta({
        id:         conv.id,
        otherName:  conv.farmers?.farm_name  || "Farmer",
        otherImage: conv.farmers?.profile_image_url || null,
      });
    } else {
      // Other party is the buyer
      setMeta({
        id:         conv.id,
        otherName:  conv.profiles?.name || "Buyer",
        otherImage: conv.profiles?.avatar_url || null,
      });
    }
  }, [conversationId, user]);

  // ── Fetch messages ─────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMeta();
    fetchMessages();
  }, [fetchMeta, fetchMessages]);

  // ── Realtime subscription ──────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // ── Auto-scroll to bottom on new messages ─────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !user || !conversationId || sending) return;
    setSending(true);
    setBody("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
    });
    if (error) {
      console.error("[chat] send error:", error.message);
      setBody(trimmed); // restore on failure
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 shrink-0">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-lg shrink-0">
            {meta?.otherImage
              ? <img src={meta.otherImage} alt={meta.otherName} className="w-full h-full object-cover" />
              : "👨‍🌾"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{meta?.otherName || "Chat"}</p>
            <p className="text-[10px] text-primary">{t("chat_online")}</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm font-semibold text-foreground">{t("chat_no_messages")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("chat_say_hello")}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border text-foreground rounded-bl-sm"}`}>
                  <p className="text-sm leading-relaxed break-words">{msg.body}</p>
                  <p className={`text-[9px] mt-0.5 ${isMine ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-16 left-0 right-0 bg-card border-t border-border z-40">
        <div className="flex items-end gap-2 px-4 py-2 max-w-2xl mx-auto">
          <textarea
            rows={1}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat_placeholder")}
            className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-90 transition-all"
          >
            {sending
              ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              : <Send className="w-4 h-4 text-primary-foreground" />}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

const ChatPage = () => (
  <AuthGuard>
    <ChatPageContent />
  </AuthGuard>
);

export default ChatPage;
