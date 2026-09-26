#!/usr/bin/env node
/**
 * Writes public/suite/packs/<pack>/content.json for the two starter packs from the tables
 * below: prompts (English and Hindi), sounds and decorative pictures.
 *
 *   node tools/suite/content/build-content.mjs
 *
 * Run make-sounds.mjs and make-images.py first: sound durations are read from the MP3
 * files (ffprobe) and picture sizes from the WebP headers, so the JSON always matches
 * the files. The Hindi here is machine-generated and needs review by a fluent speaker.
 *
 * Tone rules (docs/suite/content-packs.md): every prompt is an open invitation, never a
 * question with an answer. Nothing assumes a religion, region, caste, language, family,
 * gender role, diet or history. Prompts that touch faith or festivals carry those topics
 * so a caregiver's avoid-list removes them. Regional prompts say "some homes in the
 * region", never "your family".
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PACKS = path.join(ROOT, 'public', 'suite', 'packs')
const TODAY = '2026-09-25'
const GENERATED = { source: 'project-generated', author: 'Memoria project', license: 'CC0-1.0' }

// ---------------------------------------------------------------------------------------
// Prompts. p(id, appliesTo, en, hi, topics)
// ---------------------------------------------------------------------------------------

const p = (id, appliesTo, en, hi, topics = []) => ({ id, appliesTo, text: { en, hi }, topics })

/** Shared by both packs: one set per asset category, per activity, and per notable asset. */
const SHARED_PROMPTS = [
  // --- photos-keepsakes
  p('cat-keepsakes-1', { categories: ['photos-keepsakes'] }, 'Would you like to tell us about this?', 'क्या आप इसके बारे में कुछ बताना चाहेंगे?', ['home']),
  p('cat-keepsakes-2', { categories: ['photos-keepsakes'] }, 'Keepsakes can mean many different things. Is there anything you would like to say about this one?', 'यादगार चीज़ों के कई अलग-अलग मतलब हो सकते हैं। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['home']),
  p('cat-keepsakes-3', { categories: ['photos-keepsakes'] }, 'Does this bring anything to mind? There is no hurry.', 'क्या इससे मन में कुछ आता है? कोई जल्दी नहीं है।', ['home']),
  p('cat-keepsakes-4', { categories: ['photos-keepsakes'], activities: ['object', 'sequence'] }, 'We can look at this together for as long as you like. Is there anything you would like to share?', 'हम इसे जितनी देर चाहें साथ देख सकते हैं। क्या आप कुछ साझा करना चाहेंगे?', ['home']),
  // --- furniture
  p('cat-furniture-1', { categories: ['furniture'] }, 'Would you like to say anything about this?', 'क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['home']),
  p('cat-furniture-2', { categories: ['furniture'] }, 'Does this piece of furniture bring any place to mind?', 'क्या यह फ़र्नीचर मन में किसी जगह का ख़याल लाता है?', ['home']),
  p('cat-furniture-3', { categories: ['furniture'], activities: ['object', 'space', 'sequence'] }, 'If anything comes to mind, would you like to talk about places to sit and rest?', 'अगर मन में कुछ आए, तो क्या आप बैठने और आराम करने की जगहों के बारे में बात करना चाहेंगे?', ['home']),
  // --- storage
  p('cat-storage-1', { categories: ['storage'] }, 'Cupboards and boxes hold all kinds of things. Would you like to say anything about this one?', 'अलमारियों और बक्सों में तरह-तरह की चीज़ें रहती हैं। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['home']),
  p('cat-storage-2', { categories: ['storage'] }, 'Does this bring anything to mind? You can share as much or as little as you like.', 'क्या इससे मन में कुछ आता है? आप जितना चाहें, उतना बताएँ।', ['home']),
  p('cat-storage-3', { categories: ['storage'] }, 'What would you like to say about this?', 'आप इसके बारे में क्या कहना चाहेंगे?', ['home']),
  // --- textiles
  p('cat-textiles-1', { categories: ['textiles'] }, 'Would you like to say anything about the colours or the feel of this?', 'क्या आप इसके रंगों या इसे छूने के एहसास के बारे में कुछ कहना चाहेंगे?', ['home']),
  p('cat-textiles-2', { categories: ['textiles'] }, 'Is there a pattern or a cloth you would like to talk about?', 'क्या कोई नमूना या कपड़ा है जिसके बारे में आप बात करना चाहेंगे?', ['home']),
  p('cat-textiles-3', { categories: ['textiles'] }, 'Does this bring anything to mind? Take your time.', 'क्या इससे मन में कुछ आता है? आराम से सोचिए।', ['home']),
  // --- kitchen-food
  p('cat-kitchen-1', { categories: ['kitchen-food'] }, 'Would you like to tell us about this?', 'क्या आप इसके बारे में कुछ बताना चाहेंगे?', ['food']),
  p('cat-kitchen-2', { categories: ['kitchen-food'] }, 'Does this bring any smells or tastes to mind? Only if you would like to share.', 'क्या इससे कोई ख़ुशबू या स्वाद मन में आता है? अगर आप बताना चाहें तो।', ['food']),
  p('cat-kitchen-3', { categories: ['kitchen-food'] }, 'Kitchens are different in every home. Is there anything you would like to say about this one?', 'हर घर की रसोई अलग होती है। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['food', 'home']),
  p('cat-kitchen-4', { categories: ['kitchen-food'] }, 'Is there a meal or a drink you would like to talk about?', 'क्या कोई खाना या पेय है जिसके बारे में आप बात करना चाहेंगे?', ['food']),
  p('cat-kitchen-5', { categories: ['kitchen-food'] }, 'Some meals are for every day and some are for special days. Would you like to talk about either?', 'कुछ खाना रोज़ का होता है और कुछ ख़ास दिनों का। क्या आप किसी के बारे में बात करना चाहेंगे?', ['food', 'festivals']),
  // --- plants-outdoor
  p('cat-outdoor-1', { categories: ['plants-outdoor'] }, 'Would you like to say anything about plants or gardens?', 'क्या आप पौधों या बगीचों के बारे में कुछ कहना चाहेंगे?', ['nature']),
  p('cat-outdoor-2', { categories: ['plants-outdoor'] }, 'Does this bring any time of year or any weather to mind?', 'क्या इससे साल का कोई समय या कोई मौसम मन में आता है?', ['nature', 'weather']),
  p('cat-outdoor-3', { categories: ['plants-outdoor'] }, 'Is there anything about being outdoors you would like to talk about?', 'क्या बाहर खुले में होने के बारे में आप कुछ बात करना चाहेंगे?', ['nature']),
  // --- music-media
  p('cat-music-1', { categories: ['music-media'] }, 'Is there a sound or a song you would like to talk about?', 'क्या कोई आवाज़ या गीत है जिसके बारे में आप बात करना चाहेंगे?', ['music']),
  p('cat-music-2', { categories: ['music-media'] }, 'Does this bring any music or voices to mind? We can listen together if you like.', 'क्या इससे कोई संगीत या आवाज़ें मन में आती हैं? आप चाहें तो हम साथ सुन सकते हैं।', ['music']),
  p('cat-music-3', { categories: ['music-media'] }, 'Would you like to tell us about this?', 'क्या आप इसके बारे में कुछ बताना चाहेंगे?', ['music']),
  p('cat-music-4', { categories: ['music-media'] }, 'Music is part of many gatherings, celebrations and prayers. Would you like to talk about any music at all?', 'संगीत कई मेल-मिलापों, उत्सवों और प्रार्थनाओं का हिस्सा होता है। क्या आप किसी भी तरह के संगीत के बारे में बात करना चाहेंगे?', ['music', 'festivals', 'faith']),
  // --- school-work
  p('cat-work-1', { categories: ['school-work'] }, 'Would you like to say anything about this?', 'क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['work']),
  p('cat-work-2', { categories: ['school-work'] }, 'Is there any kind of work or learning you would like to talk about?', 'क्या किसी काम या सीखने के बारे में आप बात करना चाहेंगे?', ['work', 'school']),
  p('cat-work-3', { categories: ['school-work'] }, 'Does this bring anything to mind? Whatever you would like to share is welcome.', 'क्या इससे मन में कुछ आता है? आप जो भी बताना चाहें, उसका स्वागत है।', ['work']),
  // --- travel
  p('cat-travel-1', { categories: ['travel'] }, 'Is there a journey, short or long, you would like to talk about?', 'क्या कोई छोटी या लंबी यात्रा है जिसके बारे में आप बात करना चाहेंगे?', ['travel']),
  p('cat-travel-2', { categories: ['travel'] }, 'Would you like to say anything about getting from one place to another?', 'क्या आप एक जगह से दूसरी जगह आने-जाने के बारे में कुछ कहना चाहेंगे?', ['travel']),
  p('cat-travel-3', { categories: ['travel'] }, 'Does this bring any place to mind?', 'क्या इससे कोई जगह मन में आती है?', ['travel']),
  // --- hobbies-games
  p('cat-games-1', { categories: ['hobbies-games'] }, 'Would you like to talk about games, or things you enjoy doing?', 'क्या आप खेलों के बारे में, या जो काम आपको अच्छे लगते हैं उनके बारे में बात करना चाहेंगे?', ['games']),
  p('cat-games-2', { categories: ['hobbies-games'] }, 'Is there anything this brings to mind?', 'क्या यह मन में कुछ लाता है?', ['games']),
  p('cat-games-3', { categories: ['hobbies-games'] }, 'Would you like to tell us about this?', 'क्या आप इसके बारे में कुछ बताना चाहेंगे?', ['games']),
  // --- community
  p('cat-community-1', { categories: ['community'] }, 'Would you like to talk about the news, or anything happening around you?', 'क्या आप ख़बरों के बारे में, या आसपास जो हो रहा है उसके बारे में बात करना चाहेंगे?', ['community']),
  p('cat-community-2', { categories: ['community'] }, 'Is there anything this brings to mind?', 'क्या यह मन में कुछ लाता है?', ['community']),
  p('cat-community-3', { categories: ['community'] }, 'Would you like to say anything about people and places nearby?', 'क्या आप आसपास के लोगों और जगहों के बारे में कुछ कहना चाहेंगे?', ['community']),
  // --- lighting
  p('cat-lighting-1', { categories: ['lighting'] }, 'Would you like to say anything about this light?', 'क्या आप इस रोशनी के बारे में कुछ कहना चाहेंगे?', ['home']),
  p('cat-lighting-2', { categories: ['lighting'] }, 'Does this bring a time of day to mind?', 'क्या इससे दिन का कोई समय मन में आता है?', ['home']),
  p('cat-lighting-3', { categories: ['lighting'] }, 'Lamps and lights are part of quiet evenings and of many celebrations. Is there anything you would like to share?', 'लैंप और रोशनियाँ शांत शामों और कई उत्सवों का हिस्सा होती हैं। क्या आप कुछ साझा करना चाहेंगे?', ['home', 'festivals']),
  // --- decor
  p('cat-decor-1', { categories: ['decor'] }, 'Would you like to say anything about how this looks?', 'क्या आप इसके दिखने के बारे में कुछ कहना चाहेंगे?', ['home']),
  p('cat-decor-2', { categories: ['decor'] }, 'Is there something about this you like, or do not like?', 'क्या इसमें कुछ है जो आपको अच्छा लगता है, या अच्छा नहीं लगता?', ['home']),
  p('cat-decor-3', { categories: ['decor'] }, 'Does this bring anything to mind?', 'क्या इससे मन में कुछ आता है?', ['home']),

  // --- Activity prompts: pictures (demo pictures and personal photos alike)
  p('act-photo-1', { activities: ['photo'] }, 'What would you like to say about this picture?', 'आप इस तस्वीर के बारे में क्या कहना चाहेंगे?'),
  p('act-photo-2', { activities: ['photo'] }, 'Does this picture bring anything to mind?', 'क्या यह तस्वीर मन में कुछ लाती है?'),
  p('act-photo-3', { activities: ['photo'] }, 'Would you like to tell us about this picture? There is no hurry.', 'क्या आप इस तस्वीर के बारे में कुछ बताना चाहेंगे? कोई जल्दी नहीं है।'),
  p('act-photo-4', { activities: ['photo'] }, 'Is there a colour or a detail in this picture you would like to talk about?', 'क्या इस तस्वीर में कोई रंग या बारीकी है जिसके बारे में आप बात करना चाहेंगे?'),
  p('act-photo-5', { activities: ['photo'] }, 'Would you like to describe what you see, or anything it makes you think of?', 'क्या आप बताना चाहेंगे कि आपको क्या दिखता है, या इससे आपको क्या ख़याल आता है?'),
  // --- sounds (topic-specific ones are preferred for a sound with the same topic)
  p('act-sound-1', { activities: ['sound'] }, 'Is there a sound you would like to talk about?', 'क्या कोई आवाज़ है जिसके बारे में आप बात करना चाहेंगे?'),
  p('act-sound-2', { activities: ['sound'] }, 'Does this sound bring anything to mind?', 'क्या यह आवाज़ मन में कुछ लाती है?'),
  p('act-sound-3', { activities: ['sound'] }, 'Would you like to listen again, or say anything about it?', 'क्या आप इसे फिर से सुनना चाहेंगे, या इसके बारे में कुछ कहना चाहेंगे?'),
  p('act-sound-weather', { activities: ['sound'] }, 'Would you like to talk about the weather, or any time of year this brings to mind?', 'क्या आप मौसम के बारे में, या साल के किसी ऐसे समय के बारे में बात करना चाहेंगे जो इससे मन में आता है?', ['weather']),
  p('act-sound-music', { activities: ['sound'] }, 'Is there any music you would like to talk about?', 'क्या कोई संगीत है जिसके बारे में आप बात करना चाहेंगे?', ['music']),
  p('act-sound-travel', { activities: ['sound'] }, 'Does this sound bring any journey or any road to mind?', 'क्या यह आवाज़ किसी यात्रा या किसी रास्ते को मन में लाती है?', ['travel']),
  p('act-sound-food', { activities: ['sound'] }, 'Does this sound bring any kitchen or any meal to mind?', 'क्या यह आवाज़ किसी रसोई या किसी खाने को मन में लाती है?', ['food']),
  p('act-sound-nature', { activities: ['sound'] }, 'Would you like to say anything about birds, trees or being outdoors?', 'क्या आप पक्षियों, पेड़ों या बाहर खुले में होने के बारे में कुछ कहना चाहेंगे?', ['nature']),
  p('act-sound-home', { activities: ['sound'] }, 'Is there a sound from around a home you would like to talk about?', 'क्या घर के आसपास की कोई आवाज़ है जिसके बारे में आप बात करना चाहेंगे?', ['home']),
  p('act-sound-school', { activities: ['sound'] }, 'Does this sound bring any place or any time of day to mind?', 'क्या यह आवाज़ कोई जगह या दिन का कोई समय मन में लाती है?', ['school', 'childhood']),
  p('act-sound-work', { activities: ['sound'] }, 'Would you like to say anything about work done by hand, if anything comes to mind?', 'अगर मन में कुछ आए, तो क्या आप हाथ से किए जाने वाले काम के बारे में कुछ कहना चाहेंगे?', ['work']),
  // --- the room as a whole
  p('act-space-1', { activities: ['space'] }, 'Would you like to look around this room together? You can choose anything that catches your eye.', 'क्या आप साथ मिलकर इस कमरे को देखना चाहेंगे? जो भी चीज़ आपका ध्यान खींचे, आप उसे चुन सकते हैं।', ['home']),
  p('act-space-2', { activities: ['space'] }, 'Is there anything here you would like to look at more closely?', 'क्या यहाँ कुछ है जिसे आप और पास से देखना चाहेंगे?', ['home']),
  p('act-space-3', { activities: ['space'] }, 'Does this place bring anything to mind? Take your time.', 'क्या यह जगह मन में कुछ लाती है? आराम से देखिए।', ['home']),

  // --- Notable objects
  p('a-pressure-cooker', { assets: ['pressure-cooker'] }, 'Some kitchens have a pressure cooker like this. Is there anything you would like to say about it?', 'कुछ रसोइयों में ऐसा प्रेशर कुकर होता है। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['food', 'home']),
  p('a-pressure-cooker-sound', { assets: ['pressure-cooker'], activities: ['sound'] }, 'Does the sound of a pressure cooker bring anything to mind?', 'क्या प्रेशर कुकर की आवाज़ मन में कुछ लाती है?', ['food', 'home']),
  p('a-radio', { assets: ['radio-transistor', 'radio-valve', 'cassette-player'] }, 'Would you like to talk about radios, or anything you enjoy listening to?', 'क्या आप रेडियो के बारे में, या जो कुछ आपको सुनना अच्छा लगता है उसके बारे में बात करना चाहेंगे?', ['music']),
  p('a-radio-sound', { assets: ['radio-transistor', 'radio-valve'], activities: ['sound'] }, 'Is there a programme, a voice or a song this sound brings to mind?', 'क्या यह आवाज़ कोई कार्यक्रम, कोई आवाज़ या कोई गीत मन में लाती है?', ['music']),
  p('a-harmonium', { assets: ['harmonium'] }, 'Would you like to talk about this instrument, or any music it brings to mind?', 'क्या आप इस वाद्य के बारे में, या इससे मन में आने वाले किसी संगीत के बारे में बात करना चाहेंगे?', ['music']),
  p('a-sewing-machine', { assets: ['sewing-machine'] }, 'Does this sewing machine bring anything to mind?', 'क्या यह सिलाई मशीन मन में कुछ लाती है?', ['work', 'home']),
  p('a-bicycle', { assets: ['bicycle'] }, 'Would you like to say anything about this bicycle, or about getting around?', 'क्या आप इस साइकिल के बारे में, या आने-जाने के बारे में कुछ कहना चाहेंगे?', ['travel']),
  p('a-bicycle-sound', { assets: ['bicycle'], activities: ['sound'] }, 'Does a bicycle bell bring any street or any road to mind?', 'क्या साइकिल की घंटी किसी गली या रास्ते को मन में लाती है?', ['travel', 'community']),
  p('a-carrom', { assets: ['carrom-board'] }, 'Would you like to tell us about this game, or any games you enjoy?', 'क्या आप इस खेल के बारे में, या आपको अच्छे लगने वाले किसी खेल के बारे में बताना चाहेंगे?', ['games']),
  p('a-board-games', { assets: ['carrom-board', 'chess-set'] }, 'Board games can be quiet or lively. Would you like to say anything about this one?', 'बोर्ड वाले खेल शांत भी हो सकते हैं और जोशीले भी। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['games']),
  p('a-cricket', { assets: ['cricket-bat-ball'] }, 'Would you like to talk about cricket, or any other game, whether playing or watching?', 'क्या आप क्रिकेट के बारे में, या किसी और खेल के बारे में — खेलने या देखने के बारे में — बात करना चाहेंगे?', ['games']),
  p('a-kite', { assets: ['kite-spool'] }, 'Kites are flown on many different days in different places. Would you like to say anything about kites?', 'अलग-अलग जगहों पर अलग-अलग दिनों में पतंगें उड़ाई जाती हैं। क्या आप पतंगों के बारे में कुछ कहना चाहेंगे?', ['games', 'festivals']),
  p('a-knitting', { assets: ['knitting-basket'] }, 'Would you like to tell us about this knitting basket, or anything you like making?', 'क्या आप इस बुनाई की टोकरी के बारे में, या जो कुछ आपको बनाना अच्छा लगता है उसके बारे में बताना चाहेंगे?', ['home']),
  p('a-slate', { assets: ['school-slate'] }, 'Does this slate bring anything to mind? Share whatever you like.', 'क्या यह स्लेट मन में कुछ लाती है? जो चाहें, बताइए।', ['school', 'childhood']),
  p('a-school-bag', { assets: ['school-bag'] }, 'Would you like to say anything about this bag?', 'क्या आप इस बस्ते के बारे में कुछ कहना चाहेंगे?', ['school', 'childhood']),
  p('a-clock', { assets: ['clock-wall', 'clock-table'] }, 'Would you like to say something about this clock?', 'क्या आप इस घड़ी के बारे में कुछ कहना चाहेंगे?', ['home']),
  p('a-clock-sound', { assets: ['clock-wall', 'clock-table'], activities: ['sound'] }, 'Is there anything the ticking of a clock brings to mind?', 'क्या घड़ी की टिक-टिक मन में कुछ लाती है?', ['home']),
  p('a-calendar', { assets: ['calendar-wall'] }, 'Would you like to say anything about this calendar, or the pictures calendars sometimes have?', 'क्या आप इस कैलेंडर के बारे में, या कैलेंडरों पर कभी-कभी बनी तस्वीरों के बारे में कुछ कहना चाहेंगे?', ['home']),
  p('a-album', { assets: ['photo-album'] }, 'Would you like to look through this album together?', 'क्या आप यह एल्बम साथ मिलकर देखना चाहेंगे?', ['home']),
  p('a-frames', { assets: ['frame-wall-large', 'frame-wall-small', 'frame-table'] }, 'Would you like to say anything about this frame, or what it shows?', 'क्या आप इस फ़्रेम के बारे में, या इसमें जो दिख रहा है उसके बारे में कुछ कहना चाहेंगे?', ['home']),
  p('a-letters', { assets: ['letters-bundle'] }, 'Letters can hold many things. Would you like to talk about letters, or anything they bring to mind?', 'चिट्ठियों में बहुत कुछ हो सकता है। क्या आप चिट्ठियों के बारे में, या उनसे मन में आने वाली किसी बात के बारे में बात करना चाहेंगे?', ['family', 'community']),
  p('a-tiffin', { assets: ['tiffin-carrier'] }, 'Would you like to say anything about this tiffin carrier?', 'क्या आप इस टिफ़िन के डिब्बे के बारे में कुछ कहना चाहेंगे?', ['food', 'work']),
  p('a-spice-box', { assets: ['spice-box'] }, 'Does this spice box bring any colours or smells to mind? Only if you would like to share.', 'क्या यह मसालेदानी कोई रंग या ख़ुशबू मन में लाती है? अगर आप बताना चाहें तो।', ['food']),
  p('a-steel', { assets: ['steel-tumbler-set', 'steel-plate'] }, 'Would you like to say anything about these?', 'क्या आप इनके बारे में कुछ कहना चाहेंगे?', ['food']),
  p('a-rolling', { assets: ['rolling-board-pin'] }, 'Would you like to say anything about this rolling board and pin?', 'क्या आप इस चकले-बेलन के बारे में कुछ कहना चाहेंगे?', ['food']),
  p('a-cooking', { assets: ['kadai', 'tawa', 'gas-stove'] }, 'If anything comes to mind, would you like to talk about cooking or eating?', 'अगर मन में कुछ आए, तो क्या आप खाना बनाने या खाने के बारे में बात करना चाहेंगे?', ['food']),
  p('a-water-pot', { assets: ['clay-water-pot'] }, 'Would you like to say anything about this water pot?', 'क्या आप इस पानी के घड़े के बारे में कुछ कहना चाहेंगे?', ['home', 'weather']),
  p('a-water-sound', { assets: ['clay-water-pot', 'bucket-mug'], activities: ['sound'] }, 'Does the sound of water bring anything to mind?', 'क्या पानी की आवाज़ मन में कुछ लाती है?', ['home']),
  p('a-vessel', { assets: ['brass-vessel', 'kettle'] }, 'Would you like to say anything about this vessel?', 'क्या आप इस बर्तन के बारे में कुछ कहना चाहेंगे?', ['home', 'food']),
  p('a-pickle', { assets: ['jar-pickle'] }, 'Would you like to talk about this jar, or anything kept in jars like it?', 'क्या आप इस मर्तबान के बारे में, या ऐसे मर्तबानों में रखी जाने वाली चीज़ों के बारे में बात करना चाहेंगे?', ['food']),
  p('a-mortar', { assets: ['mortar-pestle'] }, 'Would you like to say anything about this mortar and pestle?', 'क्या आप इस इमामदस्ते के बारे में कुछ कहना चाहेंगे?', ['food']),
  p('a-lantern', { assets: ['hurricane-lantern'] }, 'Does this lantern bring any evening or any place to mind?', 'क्या यह लालटेन कोई शाम या कोई जगह मन में लाती है?', ['home']),
  p('a-fan', { assets: ['ceiling-fan'] }, 'Is there anything you would like to say about the fan, or about warm or cool days?', 'क्या आप पंखे के बारे में, या गर्म या ठंडे दिनों के बारे में कुछ कहना चाहेंगे?', ['home', 'weather']),
  p('a-fan-sound', { assets: ['ceiling-fan'], activities: ['sound'] }, 'Does this steady hum bring any room or any season to mind?', 'क्या यह धीमी भनभनाहट कोई कमरा या कोई मौसम मन में लाती है?', ['home', 'weather']),
  p('a-tv', { assets: ['television-crt'] }, 'Would you like to talk about this television, or anything you enjoy watching?', 'क्या आप इस टेलीविज़न के बारे में, या जो कुछ आपको देखना अच्छा लगता है उसके बारे में बात करना चाहेंगे?', ['home']),
  p('a-newspaper', { assets: ['newspaper-folded'] }, 'Would you like to talk about the news, or anything you enjoy hearing about?', 'क्या आप ख़बरों के बारे में, या जिन बातों के बारे में सुनना आपको अच्छा लगता है उनके बारे में बात करना चाहेंगे?', ['community']),
  p('a-typewriter', { assets: ['typewriter', 'ledger-pen'] }, 'Would you like to say anything about this, or about any kind of work?', 'क्या आप इसके बारे में, या किसी भी तरह के काम के बारे में कुछ कहना चाहेंगे?', ['work']),
  p('a-books', { assets: ['books-stack', 'bookshelf'] }, 'Would you like to talk about books, stories, or anything you enjoy hearing?', 'क्या आप किताबों, कहानियों, या जो कुछ आपको सुनना अच्छा लगता है उसके बारे में बात करना चाहेंगे?', ['home']),
  p('a-luggage', { assets: ['suitcase-old', 'trunk-tin'] }, 'Would you like to say anything about this, or about packing for a trip?', 'क्या आप इसके बारे में, या किसी सफ़र के लिए सामान बाँधने के बारे में कुछ कहना चाहेंगे?', ['travel']),
  p('a-umbrella', { assets: ['umbrella'] }, 'Does this umbrella bring any kind of weather to mind?', 'क्या यह छाता किसी तरह का मौसम मन में लाता है?', ['weather']),
  p('a-chores', { assets: ['clothesline', 'bucket-mug'] }, 'If anything comes to mind, would you like to say anything about everyday chores?', 'अगर मन में कुछ आए, तो क्या आप रोज़ के घरेलू कामों के बारे में कुछ कहना चाहेंगे?', ['home', 'work']),
  p('a-plants', { assets: ['potted-plant-large', 'potted-plant-small', 'hanging-plant', 'flower-pots-row'] }, 'Would you like to say anything about these plants, or any plants you like?', 'क्या आप इन पौधों के बारे में, या आपको पसंद आने वाले किसी पौधे के बारे में कुछ कहना चाहेंगे?', ['nature']),
  p('a-cupboard', { assets: ['almirah-steel', 'cupboard-wood'] }, 'Would you like to say anything about this cupboard?', 'क्या आप इस अलमारी के बारे में कुछ कहना चाहेंगे?', ['home']),
  p('a-seating', { assets: ['sofa-wood', 'armchair-cane', 'bench-veranda'] }, 'Does this seat bring any conversation or any quiet moment to mind?', 'क्या यह बैठने की जगह कोई बातचीत या कोई शांत पल मन में लाती है?', ['home']),
  p('a-mats', { assets: ['rug-durrie', 'floor-mat-woven'] }, 'Would you like to say anything about this mat, its colours or its pattern?', 'क्या आप इस दरी, इसके रंगों या इसके नमूने के बारे में कुछ कहना चाहेंगे?', ['home'])
]

/**
 * Northeast pack only. Facts are limited to what the sources below say, and every prompt
 * says "some homes", never "your family". Sources (checked 2026-09-25):
 *   https://en.wikipedia.org/wiki/Gamosa  (white, rectangular, red border; given to welcome guests)
 *   https://en.wikipedia.org/wiki/Jaapi   (conical hat of bamboo/cane and palm leaves; shade from sun and rain)
 *   https://en.wikipedia.org/wiki/Xorai   (tray on a pedestal, bell metal or brass; offering to guests, ceremonies)
 */
const NORTHEAST_PROMPTS = [
  p('ne-gamosa-1', { assets: ['gamosa'] }, 'Some homes in the region keep a gamosa, a woven cloth that is often white with a red border. Would you like to say anything about it, or about cloths like it?', 'इस क्षेत्र के कुछ घरों में गामोसा रखा जाता है — बुना हुआ कपड़ा, जो अक्सर सफ़ेद होता है और जिसकी किनारी लाल होती है। क्या आप इसके बारे में, या ऐसे कपड़ों के बारे में कुछ कहना चाहेंगे?', ['home', 'community']),
  p('ne-gamosa-2', { assets: ['gamosa'] }, 'In some places a gamosa is given to welcome a guest or on special days. Is there anything you would like to share about welcoming people?', 'कुछ जगहों पर मेहमान के स्वागत में या ख़ास दिनों पर गामोसा दिया जाता है। क्या आप लोगों का स्वागत करने के बारे में कुछ साझा करना चाहेंगे?', ['community', 'festivals']),
  p('ne-jaapi-1', { assets: ['jaapi'] }, 'Some homes in the region have a jaapi, a wide hat woven from bamboo or cane and leaves. Would you like to say anything about it?', 'इस क्षेत्र के कुछ घरों में जापी होती है — बाँस या बेंत और पत्तों से बुनी चौड़ी टोपी। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['home']),
  p('ne-jaapi-2', { assets: ['jaapi'] }, 'A wide hat like this can keep off both sun and rain. Does it bring any weather or any work outdoors to mind?', 'ऐसी चौड़ी टोपी धूप और बारिश दोनों से बचा सकती है। क्या यह कोई मौसम या बाहर का कोई काम मन में लाती है?', ['weather', 'work']),
  p('ne-xorai-1', { assets: ['xorai'] }, 'Some homes in the region keep a xorai, a tray on a stand, often of brass or bell metal. It may be used to offer things to guests, and in some ceremonies. Would you like to say anything about it?', 'इस क्षेत्र के कुछ घरों में सराई रखी जाती है — स्टैंड पर रखी थाली, जो अक्सर पीतल या काँसे की होती है। इसका उपयोग मेहमानों को कुछ भेंट करने में, और कुछ अनुष्ठानों में हो सकता है। क्या आप इसके बारे में कुछ कहना चाहेंगे?', ['community', 'faith', 'festivals']),
  p('ne-basket-1', { assets: ['bamboo-basket'] }, 'Baskets woven from bamboo are made and used in many homes, in the region and elsewhere. Would you like to say anything about baskets like this?', 'बाँस से बुनी टोकरियाँ इस क्षेत्र में और दूसरी जगहों पर भी कई घरों में बनाई और इस्तेमाल की जाती हैं। क्या आप ऐसी टोकरियों के बारे में कुछ कहना चाहेंगे?', ['home', 'work']),
  p('ne-basket-2', { assets: ['bamboo-basket'] }, 'Would you like to talk about things made by hand, whether this basket or anything else?', 'क्या आप हाथ से बनी चीज़ों के बारे में बात करना चाहेंगे — यह टोकरी हो या कुछ और?', ['work', 'home'])
]

// ---------------------------------------------------------------------------------------
// Sounds and pictures
// ---------------------------------------------------------------------------------------

const s = (id, en, hi, den, dhi, topics, loop = false) => ({ id, label: { en, hi }, description: { en: den, hi: dhi }, topics, loop })

const SOUNDS = [
  s('snd-wall-clock', 'Wall clock', 'दीवार घड़ी', 'A clock ticking in a quiet room.', 'शांत कमरे में टिक-टिक करती घड़ी।', ['home']),
  s('snd-pressure-cooker', 'Pressure cooker', 'प्रेशर कुकर', 'A pressure cooker on a low flame, then whistling twice.', 'धीमी आँच पर प्रेशर कुकर, फिर दो सीटियाँ।', ['food', 'home']),
  s('snd-rain-roof', 'Rain on a roof', 'छत पर बारिश', 'Steady rain on a roof, with a few heavier drops.', 'छत पर लगातार बारिश, कुछ भारी बूँदों के साथ।', ['weather', 'nature', 'home'], true),
  s('snd-birds-morning', 'Morning birds', 'सुबह के पक्षी', 'Birds chirping and calling in the morning.', 'सुबह चहचहाते और पुकारते पक्षी।', ['nature']),
  s('snd-bicycle-bell', 'Bicycle bell', 'साइकिल की घंटी', 'A bicycle bell ringing twice.', 'दो बार बजती साइकिल की घंटी।', ['travel', 'community']),
  s('snd-school-bell', 'Hand bell', 'हाथ की घंटी', 'A brass hand bell, like a school bell, rung a few times and heard across a yard.', 'स्कूल की घंटी जैसी पीतल की हाथ की घंटी, जो कुछ बार बजाई गई और आँगन के पार से सुनाई देती है।', ['school', 'childhood']),
  s('snd-radio-tuning', 'Radio tuning', 'रेडियो ट्यून करना', 'A radio dial turned through static until a soft tune comes in.', 'रेडियो की सुई घुमाने पर खरखराहट, फिर एक धीमी धुन।', ['music', 'home']),
  s('snd-ceiling-fan', 'Ceiling fan', 'छत का पंखा', 'A ceiling fan turning with a steady hum.', 'धीमी भनभनाहट के साथ घूमता छत का पंखा।', ['home', 'weather'], true),
  s('snd-harmonium', 'Harmonium', 'हारमोनियम', 'A harmonium playing a held note and a short, simple phrase.', 'हारमोनियम पर एक लंबा स्वर और एक छोटी, सरल धुन।', ['music']),
  s('snd-train', 'Train', 'रेलगाड़ी', 'A train running over the rails, with a distant horn.', 'पटरियों पर चलती रेलगाड़ी, दूर से आती हॉर्न की आवाज़ के साथ।', ['travel']),
  s('snd-sewing-machine', 'Sewing machine', 'सिलाई मशीन', 'A sewing machine stitching in two short runs.', 'दो छोटे दौर में सिलाई करती सिलाई मशीन।', ['work', 'home']),
  s('snd-water-pouring', 'Water pouring', 'पानी डालना', 'Water poured into a vessel as it fills, then a few drips.', 'बर्तन में डाला जाता पानी, भरते हुए, फिर कुछ बूँदें।', ['home'])
]

/** The Northeast pack reuses these everyday sounds from the everyday-home pack's files. */
const NORTHEAST_SOUND_IDS = ['snd-rain-roof', 'snd-birds-morning', 'snd-wall-clock', 'snd-radio-tuning', 'snd-water-pouring', 'snd-bicycle-bell', 'snd-ceiling-fan', 'snd-train']

const NOTICE = { en: 'Demo picture — an illustration, not a real place or memory', hi: 'डेमो चित्र — यह एक चित्रण है, कोई असली जगह या याद नहीं' }
const img = (id, en, hi) => ({ id, alt: { en, hi } })

const IMAGES = {
  'everyday-home': [
    img('pic-river-dusk', 'An illustration of a river at dusk, with trees on the bank and a small boat.', 'शाम के समय एक नदी का चित्र, जिसके किनारे पेड़ हैं और एक छोटी नाव है।'),
    img('pic-hills-morning', 'An illustration of green hills in the morning, with a path and a small house.', 'सुबह के समय हरी पहाड़ियों का चित्र, जिसमें एक रास्ता और एक छोटा घर है।'),
    img('pic-seaside', 'An illustration of a beach with palm trees and a distant sail.', 'ताड़ के पेड़ों और दूर एक पाल वाली नाव के साथ समुद्र तट का चित्र।'),
    img('pic-flowers', 'An illustration of garden flowers in soft colours.', 'हल्के रंगों में बगीचे के फूलों का चित्र।'),
    img('pic-fruit-bowl', 'An illustration of a bowl of fruit on a striped cloth.', 'धारीदार कपड़े पर रखे फलों के कटोरे का चित्र।'),
    img('pic-train-window', 'An illustration of fields and trees seen through a train window.', 'रेलगाड़ी की खिड़की से दिखते खेतों और पेड़ों का चित्र।')
  ],
  'northeast-home': [
    img('pic-hills-mist', 'An illustration of layered hills with mist between them.', 'परत-दर-परत पहाड़ियों का चित्र, जिनके बीच धुंध है।'),
    img('pic-bamboo-grove', 'An illustration of a bamboo grove in soft light.', 'हल्की रोशनी में बाँस के झुरमुट का चित्र।'),
    img('pic-paddy-fields', 'An illustration of green paddy fields with hills behind.', 'पीछे पहाड़ियों के साथ हरे धान के खेतों का चित्र।')
  ]
}

// ---------------------------------------------------------------------------------------
// File facts
// ---------------------------------------------------------------------------------------

function ffprobeDurationMs(file) {
  const probe = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe'].find(existsSync) ?? 'ffprobe'
  const r = spawnSync(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  const seconds = Number(r.stdout.trim())
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`cannot read the duration of ${file} (run make-sounds.mjs first)`)
  return Math.round(seconds * 1000)
}

/** Width and height from a WebP file's header (lossy VP8, lossless VP8L or extended VP8X). */
export function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not a WebP file')
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21)
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  throw new Error(`unknown WebP chunk ${chunk}`)
}

// ---------------------------------------------------------------------------------------

function soundDef(def, pathFromPack) {
  const file = path.join(PACKS, 'everyday-home', 'sounds', `${def.id}.mp3`)
  const out = {
    id: def.id,
    label: def.label,
    description: def.description,
    path: pathFromPack,
    mime: 'audio/mpeg',
    durationMs: ffprobeDurationMs(file),
    topics: def.topics,
    synthesized: true,
    provenance: { ...GENERATED, modified: `Synthesized by tools/suite/content/make-sounds.mjs (${TODAY}); mono MP3, 24 kHz, 48 kbit/s, normalised to about -18 LUFS.` }
  }
  if (def.loop) out.loop = true
  return out
}

function imageDefs(pack) {
  return IMAGES[pack].map((def) => {
    const rel = `images/${def.id}.webp`
    const { width, height } = webpSize(readFileSync(path.join(PACKS, pack, rel)))
    return {
      id: def.id,
      path: rel,
      width,
      height,
      alt: def.alt,
      kind: 'decorative-generated',
      notice: NOTICE,
      provenance: { ...GENERATED, modified: `Drawn by tools/suite/content/make-images.py (${TODAY}); flat illustration, WebP.` }
    }
  })
}

function write(pack, content) {
  const file = path.join(PACKS, pack, 'content.json')
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n')
  console.log(`${pack}/content.json: ${content.prompts.length} prompts, ${content.sounds.length} sounds, ${content.images.length} images`)
}

write('everyday-home', {
  schema: 1,
  prompts: SHARED_PROMPTS,
  sounds: SOUNDS.map((d) => soundDef(d, `sounds/${d.id}.mp3`)),
  images: imageDefs('everyday-home')
})

write('northeast-home', {
  schema: 1,
  prompts: [...SHARED_PROMPTS, ...NORTHEAST_PROMPTS],
  sounds: SOUNDS.filter((d) => NORTHEAST_SOUND_IDS.includes(d.id)).map((d) => soundDef(d, `../everyday-home/sounds/${d.id}.mp3`)),
  images: imageDefs('northeast-home')
})
