-- Bucket PRIVÉ pour les photos terrain et pièces jointes.
-- Aucune policy sur storage.objects : seule l'Edge Function (clé service_role)
-- lit et écrit ; le mobile reçoit des URLs signées à durée limitée.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'operix-media',
  'operix-media',
  false,
  5242880, -- 5 Mo, comme la validation de l'ancienne API (image max:5120)
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;
