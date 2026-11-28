-- v37.0.1 — Arabic names for the 41 car brands that were seeded with their English name in the
-- Arabic field (mostly new American, Chinese and European EV makers). Only a label still equal to
-- its English one is changed, so an operator's own Arabic name is left alone.
UPDATE "platform_enumeration" AS e
SET "labelAr" = v.ar, "updatedAt" = now()
FROM (VALUES
  ('aptera', 'أبتيرا'),
  ('drako_motors', 'دراكو موتورز'),
  ('edisonfuture', 'إديسون فيوتشر'),
  ('faraday_future', 'فاراداي فيوتشر'),
  ('fisker', 'فيسكر'),
  ('karma_automotive', 'كارما'),
  ('lordstown_motors', 'لوردستاون موتورز'),
  ('lucid', 'لوسيد'),
  ('mullen_automotive', 'مولين'),
  ('nikola', 'نيكولا'),
  ('rezvani', 'رزفاني'),
  ('rivian', 'ريفيان'),
  ('aito', 'آيتو'),
  ('aion', 'أيون'),
  ('aiways', 'آي وايز'),
  ('arcfox', 'آرك فوكس'),
  ('byton', 'بايتون'),
  ('baojun', 'باوجون'),
  ('enovate', 'إينوفيت'),
  ('evergrande_hengchi', 'إيفرجراند (هينغ تشي)'),
  ('foxtron', 'فوكسترون'),
  ('hiphi', 'هاي فاي'),
  ('im_motors', 'آي إم موتورز'),
  ('jmc', 'جي إم سي'),
  ('neta_auto', 'نيتا'),
  ('ora', 'أورا'),
  ('qoros', 'كوروس'),
  ('rising_auto', 'رايزنج أوتو'),
  ('seres', 'سيريس'),
  ('singulato', 'سينجولاتو'),
  ('skywell', 'سكاي ويل'),
  ('thunder_power', 'ثاندر باور'),
  ('weltmeister', 'فيلتمايستر'),
  ('xiaomi', 'شاومي'),
  ('aehra', 'إيرا'),
  ('elaris', 'إيلاريس'),
  ('evolute', 'إيفوليوت'),
  ('freze', 'فريز'),
  ('lightyear', 'لايت يير'),
  ('nevs', 'نيفس'),
  ('piech_automotive', 'بييش')
) AS v(key, ar)
WHERE e."type" = 'car_brand' AND e."key" = v.key AND e."labelAr" = e."labelEn";
