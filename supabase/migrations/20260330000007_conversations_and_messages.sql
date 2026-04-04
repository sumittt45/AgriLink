-- ─────────────────────────────────────────────────────────────────────────────
-- Conversations + Messages tables
-- Referenced by ChatPage and FarmProfilePage but missing from all prior
-- migrations.  Safe to re-run (CREATE TABLE IF NOT EXISTS throughout).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farmer_id  UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, farmer_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Participants can read their own conversations
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
CREATE POLICY "conversations_select_own"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR auth.uid() IN (SELECT user_id FROM public.farmers WHERE id = farmer_id)
  );

-- Buyers can create conversations
DROP POLICY IF EXISTS "conversations_insert_buyer" ON public.conversations;
CREATE POLICY "conversations_insert_buyer"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

GRANT SELECT, INSERT ON public.conversations TO authenticated;

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Participants can read messages in their conversations
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE buyer_id = auth.uid()
         OR farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
    )
  );

-- Participants can send messages
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE buyer_id = auth.uid()
         OR farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.messages TO authenticated;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');
