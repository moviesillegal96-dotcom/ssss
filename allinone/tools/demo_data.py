#!/usr/bin/env python3
"""Writes a data file filled with made-up content, for a demo build of the app that holds no personal notes.

    python3 tools/demo_data.py app/data-demo.js

Everything here is fictional: a student called Raka, a sample school, sample notes, links to public sites.
Besides the library it carries a "demo" seed (to-dos, deadlines, grades, money) that the app applies on first
start, with dates relative to that day, so the demo always looks lived in.
"""
import json
import sys
from datetime import datetime

n = 0


def bid(prefix, kind):
    global n
    n += 1
    return '%s#%s%d' % (prefix, kind, n)


def h(x, l=3):
    return {'t': 'h', 'l': l, 'x': x}


def p(x, m=False):
    b = {'t': 'p', 'x': x}
    if m:
        b['m'] = 1
    return b


def note(x, k='warn'):
    return {'t': 'note', 'k': k, 'x': x}


def ul(sec, items):
    return {'t': 'ul', 'id': bid(sec, 'l'), 'items': [{'x': x} for x in items]}


def check(sec, items, **extra):
    b = {'t': 'check', 'id': bid(sec, 'c'), 'items': [{'x': x} if isinstance(x, str) else x for x in items]}
    b.update(extra)
    return b


def table(head, rows, days=False):
    b = {'t': 'table', 'head': head, 'rows': rows}
    if days:
        b['days'] = 1
    return b


def section(sheet, slug, title, blocks):
    return {'id': sheet + '/' + slug, 'title': title, 'blocks': blocks}


DAYS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']
seeds = {}

# ---------------- Sekolah ----------------
S = 'sekolah'
pulsek = check(S + '/to-do-pulang-sekolah', ['Beres-beres tas & seragam', 'Mandi', 'Makan', 'Sholat', 'Istirahat 20 menit',
                                            'Kerjain PR yang deadline-nya paling dekat', 'Cek grup kelas', 'Siapin buku buat besok'], daily=1)
seeds['pulsek'] = pulsek['id']
grades = {'t': 'grades', 'id': bid(S + '/nilai', 'n'), 'target': 80,
          'subjects': ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia', 'Bahasa Inggris', 'Sejarah', 'Ekonomi', 'Informatika', 'PJOK']}
sekolah = {'id': S, 'title': 'SEKOLAH', 'icon': '🏫', 'sections': [
    section(S, 'jadwal-pelajaran', 'JADWAL PELAJARAN', [
        p('Contoh jadwal kelas XI — SMA Harapan Bangsa (sekolah fiktif).', m=True),
        h('📚 MATA PELAJARAN PER HARI'),
        table(DAYS, [{'g': 'Jam 1–4'},
                     ['Matematika', 'Fisika', 'Bahasa Indonesia', 'Kimia', 'Biologi'],
                     ['Bahasa Inggris', 'Ekonomi', 'Matematika', 'Sejarah', 'Informatika'],
                     {'g': 'Jam 5–8'},
                     ['Sejarah', 'PJOK', 'Biologi', 'Bahasa Inggris', 'Pendidikan Agama'],
                     ['Informatika', 'Seni Budaya', 'Kimia', 'Matematika', 'Ekstrakurikuler']], days=True),
        h('👕 SERAGAM'),
        table(DAYS, [['Putih abu-abu', 'Putih abu-abu', 'Pramuka', 'Batik sekolah', 'Baju olahraga']], days=True),
        note('Jaket wajib dibawa kalau pulang sore.'),
    ]),
    section(S, 'jadwal-sekolah-kegiatan', 'JADWAL SEKOLAH & KEGIATAN', [
        h('JADWAL MINGGUAN'),
        table(['Hari', 'Sekolah / Ujian', 'Kegiatan', 'Catatan'], [
            ['Senin', 'Ulangan Matematika', 'Latihan basket 15.30', 'Bawa kalkulator'],
            ['Selasa', '-', 'Les Bahasa Inggris 16.00', '-'],
            ['Rabu', 'Praktikum Kimia', '-', 'Bawa jas lab'],
            ['Kamis', 'Presentasi Biologi', 'Rapat OSIS', '-'],
            ['Jumat', 'Kuis Sejarah', 'Futsal bareng kelas', 'Pulang lebih awal']]),
        h('PIKIRIN YANG PENTING SEKARANG DULU'),
        ul(S + '/jadwal-sekolah-kegiatan', ['Siapin semua malam sebelumnya, biar pagi tinggal jalan.',
                                             'Kalau telat jangan panik — santai, masuk aja.',
                                             'Hati-hati di jalan, nggak usah ngebut.']),
        h('Info dari wali kelas'),
        ul(S + '/jadwal-sekolah-kegiatan', ['Jumat depan pulang jam 11 karena rapat guru.',
                                             'Bawa fotokopi kartu pelajar buat study tour.']),
    ]),
    section(S, 'nilai', 'NILAI', [p('Isi nilai tiap ada ulangan, tugas, atau ujian. Rata-rata dihitung otomatis.', m=True), grades]),
    section(S, 'tugas-info', 'TUGAS & INFO', [
        h('📝 PR & TUGAS'),
        check(S + '/tugas-info', [
            {'x': 'Matematika — Latihan bab 4 nomor 1–20', 'n': 'Deadline: Senin'},
            {'x': 'Biologi — Video ekosistem 3 menit', 'n': 'Kelompok 4 orang'},
            {'x': 'Bahasa Inggris — Essay 300 kata "My Dream Job"', 'n': 'Kumpul di Google Classroom'},
            {'x': 'Sejarah — Rangkuman bab Kerajaan Hindu-Buddha', 'd': 1},
            {'x': 'Kimia — Laporan praktikum titrasi', 'n': 'Tulis tangan'}]),
        h('DAFTAR GURU'),
        table(['Nama', 'Mapel'], [['Bu Sari', 'Matematika'], ['Pak Dimas', 'Fisika'], ['Bu Rina', 'Kimia'],
                                  ['Pak Agus', 'Sejarah'], ['Bu Lestari', 'Bahasa Inggris (wali kelas)']]),
    ]),
    section(S, 'to-do-pulang-sekolah', 'TO DO PULANG SEKOLAH', [note('Yang penting pulang sekolah: beres-beres, makan, belajar. Sisanya singkat aja.'), pulsek]),
]}

# ---------------- Rumah ----------------
R = 'rumah'
weekly = {'t': 'grid', 'id': bid(R + '/mingguan-bulanan', 'g'), 'kind': 'weekly', 'items': [
    {'x': 'Ganti sarung bantal', 'cat': 'Kamar', 'freq': '1x / minggu', 'dur': '5', 'fixed': 'Minggu', 'days': [7]},
    {'x': 'Vacuum & pel kamar', 'cat': 'Kamar', 'freq': '1x / minggu', 'dur': '20', 'fixed': 'Sabtu', 'days': [6]},
    {'x': 'Cuci sepatu sekolah', 'cat': 'Pakaian', 'freq': '1x / minggu', 'dur': '15', 'fixed': 'Sabtu', 'days': [6]},
    {'x': 'Siram tanaman', 'cat': 'Rumah', 'freq': '3x / minggu', 'dur': '10', 'fixed': 'Senin, Rabu, Jumat', 'days': [1, 3, 5]},
    {'x': 'Buang sampah kamar', 'cat': 'Rumah', 'freq': '2x / minggu', 'dur': '5', 'fixed': 'Selasa & Jumat', 'days': [2, 5]},
    {'x': 'Evaluasi minggu ini', 'cat': 'Produktivitas', 'freq': '1x / minggu', 'dur': '15', 'fixed': 'Minggu', 'days': [7]},
    {'x': 'Cek motor (ban, rem, lampu)', 'cat': 'Kendaraan', 'freq': '1x / minggu', 'dur': '10', 'fixed': 'Minggu', 'days': [7]}]}
monthly = {'t': 'grid', 'id': bid(R + '/mingguan-bulanan', 'g'), 'kind': 'monthly', 'items': [
    {'x': 'Cuci sprei & selimut', 'cat': 'Kamar', 'freq': '1x / bulan', 'dur': '15', 'fixed': '5', 'dom': 5},
    {'x': 'Bersihin kipas angin', 'cat': 'Rumah', 'freq': '1x / bulan', 'dur': '15', 'fixed': '12', 'dom': 12},
    {'x': 'Rapihin lemari', 'cat': 'Kamar', 'freq': '1x / bulan', 'dur': '30', 'fixed': '20', 'dom': 20},
    {'x': 'Backup foto HP ke laptop', 'cat': 'Digital', 'freq': '1x / bulan', 'dur': '20', 'fixed': '28', 'dom': 28},
    {'x': 'Potong rambut', 'cat': 'Diri', 'freq': '1x / 1-2 bulan'}]}
rumah = {'id': R, 'title': 'RUMAH', 'icon': '🏠', 'sections': [
    section(R, 'to-do', 'TO DO', [check(R + '/to-do', ['Benerin lampu meja', 'Install aplikasi edit video di laptop', 'Bersihin keyboard',
                                                        'Beli rak buku kecil', {'x': 'Rapihin kabel di meja', 'd': 1}, 'Print jadwal pelajaran'])]),
    section(R, 'jadwal-harian', 'JADWAL HARIAN', [
        note('"Pelan-pelan asal konsisten."', 'quote'),
        table(['JAM', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'], [], days=True),
        h('CATATAN'),
        ul(R + '/jadwal-harian', ['Tidur paling lambat jam 22.00.', 'Sabtu-Minggu tetap belajar 2 jam pagi.', 'HP ditaruh jauh pas belajar.']),
    ]),
    section(R, 'mingguan-bulanan', 'MINGGUAN & BULANAN', [h('📅 MINGGUAN'), weekly, h('🗓️ BULANAN'), monthly]),
    section(R, 'kucing', 'KUCING', [
        h('🐱 PERAWATAN (kucing: Mochi)'),
        table(['Item', 'Frekuensi'], [['Makan kering', '2x sehari, 40 gr'], ['Ganti air minum', 'Tiap hari'],
                                      ['Sisir bulu', '2x / minggu'], ['Obat cacing', '3 bulan sekali']]),
        h('🛒 BELANJA'),
        check(R + '/kucing', ['Pasir kucing 10 L', 'Makanan kering 1 kg', 'Snack kucing']),
    ]),
]}
seeds['grids'] = [weekly['id'], monthly['id']]

# ---------------- Belajar ----------------
B = 'belajar'
picks = []
for i, (day, focus, items) in enumerate([
        ('SENIN', 'Matematika', ['Latihan soal 30 menit', 'Review catatan kelas', 'Duolingo 15 menit']),
        ('SELASA', 'Fisika', ['Video materi + catat', 'Latihan soal 20 menit', 'Baca buku 20 halaman']),
        ('RABU', 'Kimia', ['Flashcard istilah', 'Kerjain PR', 'Belajar coding 30 menit']),
        ('KAMIS', 'Biologi', ['Bikin mind map', 'Latihan soal', 'Duolingo 15 menit']),
        ('JUMAT', 'Bahasa Inggris', ['Nonton video tanpa subtitle', 'Tulis 1 paragraf', 'Review mingguan']),
        ('SABTU', 'Bebas', ['Tryout mini 45 menit', 'Belajar desain', 'Baca buku']),
        ('MINGGU', 'Bebas', ['Ulang soal yang salah', 'Rencanain minggu depan'])]):
    picks.append(h('%s — 16.00-18.00 (%s)' % (day, focus)))
    picks.append(check(B + '/detail-belajar', items, day=i + 1))
belajar = {'id': B, 'title': 'BELAJAR', 'icon': '📚', 'sections': [
    section(B, 'detail-belajar', 'DETAIL BELAJAR', [note('Pilih minimal 2 kegiatan tiap hari.', 'info')] + picks),
    section(B, 'cara-belajar', 'CARA BELAJAR', [
        h('📌 ACTIVE RECALL'), ul(B + '/cara-belajar', ['Tutup buku, coba jelasin dari ingatan.', 'Cek yang salah, ulang lagi besok.']),
        h('📌 POMODORO'), ul(B + '/cara-belajar', ['25 menit fokus, 5 menit istirahat.', 'Setelah 4 sesi, istirahat 20 menit.']),
        h('📌 SPACED REPETITION'), ul(B + '/cara-belajar', ['Review H+1, H+3, H+7.', 'Pakai flashcard (Anki / Quizlet).']),
        h('🌐 WEBSITE BELAJAR'), ul(B + '/cara-belajar', ['Khan Academy — https://www.khanacademy.org', 'Desmos — https://www.desmos.com/calculator']),
    ]),
    section(B, 'to-learn', 'MAU DIPELAJARI', [check(B + '/to-learn', ['Mengetik 10 jari', 'Dasar Python', 'Public speaking', 'Edit video', 'Dasar keuangan pribadi'])]),
]}

# ---------------- Olahraga ----------------
O = 'olahraga'
olahraga = {'id': O, 'title': 'OLAHRAGA', 'icon': '🏋️', 'sections': [
    section(O, 'checklist-gym', 'CHECKLIST GYM', [
        check(O + '/checklist-gym', ['Botol minum', 'Handuk kecil', 'Baju ganti', 'Earphone'], title='🎒 BAWAAN'),
        check(O + '/checklist-gym', ['Pemanasan 5 menit', 'Latihan utama', 'Pendinginan & stretching'], title='💪 DI GYM'),
    ]),
    section(O, 'rencana-latihan', 'RENCANA LATIHAN', [
        table(['Hari', 'Latihan'], [['Senin', 'Full body A'], ['Rabu', 'Jogging 20 menit'], ['Jumat', 'Full body B'], ['Minggu', 'Istirahat / jalan santai']]),
        h('Target'), ul(O + '/rencana-latihan', ['Tidur 7–8 jam.', 'Minum air 2–3 liter sehari.', 'Konsisten 3 bulan dulu.']),
    ]),
]}

# ---------------- Uang ----------------
U = 'uang'
uang = {'id': U, 'title': 'UANG', 'icon': '💰', 'sections': [
    section(U, 'catatan-uang', 'CATATAN UANG', [
        h('💵 CARA DAPET UANG TAMBAHAN'),
        table(['Ide', 'Modal', 'Catatan'], [['Jasa desain poster', 'Rp0', 'Pakai Canva'], ['Jualan stiker', 'Rp100rb', 'Pre-order dulu'],
                                           ['Les privat SD', 'Rp0', 'Matematika dasar']]),
        h('📊 BUDGET BULANAN'),
        table(['Sumber', 'Jumlah (Rp)'], [['Uang jajan', '800000'], ['Freelance', '200000']]),
        table(['Kategori', 'Min (Rp)', 'Max (Rp)', 'Wajib?'], [['Makan & jajan', '300000', '300000', 'Wajib'], ['Bensin', '120000', '120000', 'Wajib'],
                                                              ['Kuota', '60000', '60000', 'Wajib'], ['Nongkrong', '150000', '150000', 'Opsional'],
                                                              ['Tabungan', '250000', '250000', 'Wajib']]),
        h('🏦 AKUN'),
        {'t': 'ledger', 'id': bid(U + '/catatan-uang', 'm'), 'accounts': [{'name': 'Dompet', 'start': 0}]},
    ]),
    section(U, 'prinsip-uang', 'PRINSIP UANG', [ul(U + '/prinsip-uang', ['Nabung dulu, baru jajan.', 'Tunggu 24 jam sebelum beli barang yang nggak penting.',
                                                                          'Catat pengeluaran tiap malam.'])]),
]}
seeds['budget'] = [{'name': 'Makan & jajan', 'limit': 300000, 'must': 1}, {'name': 'Bensin', 'limit': 120000, 'must': 1},
                   {'name': 'Kuota', 'limit': 60000, 'must': 1}, {'name': 'Nongkrong', 'limit': 150000, 'must': 0},
                   {'name': 'Tabungan', 'limit': 250000, 'must': 1}]
seeds['income'] = [{'name': 'Uang jajan', 'amount': 800000}, {'name': 'Freelance', 'amount': 200000}]

# ---------------- Prinsip ----------------
P = 'prinsip'
prinsip = {'id': P, 'title': 'PRINSIP & TUJUAN', 'icon': '🧭', 'sections': [
    section(P, 'tujuan', 'TUJUAN', [h('TUJUAN JANGKA PANJANG', 2),
                                    table([], [['1', 'Nilai rata-rata minimal 85.'], ['2', 'Masuk jurusan Teknik Informatika.'],
                                               ['3', 'Punya tabungan sendiri sebelum lulus.'], ['4', 'Badan sehat & kuat.']])]),
    section(P, 'prinsip-hidup', 'PRINSIP HIDUP', [
        h('Mindset'), ul(P + '/prinsip-hidup', ['Hidup itu simpel, pikiran yang bikin ribet.', 'Selesaiin yang paling susah duluan.', 'Bandingin diri sama diri kemarin, bukan orang lain.']),
        h('Sosial'), ul(P + '/prinsip-hidup', ['Pikir dulu sebelum ngomong.', 'Dengerin lebih banyak daripada ngomong.', 'Jaga rahasia orang.']),
        note('"Comparison is the thief of joy." — Theodore Roosevelt', 'quote'),
    ]),
    section(P, 'doa', 'DOA', [h('📿 Doa sebelum belajar'), p('Rabbi zidni ilma warzuqni fahma.'), note('"Ya Allah, tambahkanlah ilmuku dan berilah aku pemahaman."', 'quote')]),
]}

# ---------------- Hiburan ----------------
H = 'hiburan'
fun = {'t': 'grid', 'id': bid(H + '/hiburan-wishlist', 'g'), 'kind': 'fun', 'items': [
    {'x': 'Main game 1 jam', 'cat': 'Gaming', 'freq': 'Sesuka hati'}, {'x': 'Nonton film', 'cat': 'Hiburan', 'freq': 'Sesuka hati'},
    {'x': 'Main sama kucing', 'cat': 'Kucing', 'freq': 'Tiap hari'}, {'x': 'Jalan sore keliling komplek', 'cat': 'Olahraga', 'freq': 'Sesuka hati'}]}
seeds['grids'].append(fun['id'])
hiburan = {'id': H, 'title': 'HIBURAN & WISHLIST', 'icon': '🎬', 'sections': [
    section(H, 'hiburan-wishlist', 'HIBURAN & WISHLIST', [
        h('📚 BUKU'), table(['Judul', 'Penulis'], [['Atomic Habits', 'James Clear'], ['Laskar Pelangi', 'Andrea Hirata'], ['Sapiens', 'Yuval Noah Harari']]),
        h('🎬 TONTONAN'), ul(H + '/hiburan-wishlist', ['Dokumenter luar angkasa', 'Anime musim ini', 'Film keluarga akhir pekan']),
        h('⭐ WISHLIST'), check(H + '/hiburan-wishlist', ['Keyboard mekanik', 'Headphone', 'Lampu meja LED', 'Sepatu lari']),
        h('🎉 SELF REWARD'), fun,
    ]),
]}

# ---------------- Link ----------------
L = 'link'
link = {'id': L, 'title': 'LINK TERSIMPAN', 'icon': '🔗', 'sections': [
    section(L, 'link', 'LINK TERSIMPAN', [
        h('Belajar'), ul(L + '/link', ['https://www.khanacademy.org', 'https://www.duolingo.com', 'https://www.w3schools.com']),
        h('Tonton nanti'), ul(L + '/link', ['https://www.youtube.com/@TEDEd', 'https://www.youtube.com/@kurzgesagt']),
    ]),
]}

# ---------------- seeds ----------------
week = ['Bangun, sholat, mandi\nSiap-siap & sarapan', 'SEKOLAH', 'Pulang, makan, istirahat', 'BELAJAR*', 'Main sama kucing\nHave fun',
        'Siapin buat besok\nSikat gigi', 'TIDUR']
tt = {}
for d in range(1, 8):
    if d <= 5:
        tt[str(d)] = [{'s': 5, 'e': 6, 'x': week[0]}, {'s': 6, 'e': 14, 'x': week[1]}, {'s': 14, 'e': 16, 'x': week[2]},
                      {'s': 16, 'e': 18, 'x': week[3]}, {'s': 19, 'e': 20, 'x': week[4]}, {'s': 20, 'e': 21, 'x': week[5]}, {'s': 21, 'e': 24, 'x': week[6]}]
    else:
        tt[str(d)] = [{'s': 7, 'e': 8, 'x': 'Bangun, mandi, sarapan'}, {'s': 8, 'e': 10, 'x': 'BELAJAR*'}, {'s': 10, 'e': 17, 'x': 'HAVE FUN'},
                      {'s': 19, 'e': 20, 'x': week[4]}, {'s': 21, 'e': 24, 'x': week[6]}]
seeds['timetable'] = tt
seeds['home'] = ['Pelan-pelan asal konsisten.', 'Selesaiin yang paling susah duluan.', 'Target: nilai rata-rata 85, masuk Teknik Informatika.',
                 'Hidup itu simpel, pikiran yang bikin ribet.']
seeds['reminders'] = [
    {'id': 'pagi', 'label': 'Pagi', 'icon': '🌅', 'time': '05:30', 'timeWE': '07:30', 'lines': ['Santai aja di jalan, nggak usah ngebut.', 'Berdoa dulu sebelum berangkat.']},
    {'id': 'siang', 'label': 'Siang', 'icon': '☀️', 'time': '12:00', 'timeWE': '12:00', 'lines': ['Pikir dulu sebelum ngomong.', 'Minum air putih.']},
    {'id': 'sore', 'label': 'Sore', 'icon': '🌇', 'time': '15:00', 'timeWE': '16:00', 'lines': ['Mandi dulu, baru yang lain.', 'Ada PR? Kerjain sekarang biar malamnya santai.']}]
seeds['tasks'] = [{'title': 'Main futsal bareng temen', 'time': '16:00', 'group': 'Sosial', 'rep': {'k': 'nw', 'n': 2, 'days': [6]}}]
# Applied once on first start; "day" is days from that day, "mo" months back.
seeds['demo'] = {
    'todos': [{'x': 'Siapin seragam pramuka', 'day': 0, 'done': 1}, {'x': 'Kerjain PR Matematika bab 4', 'day': 0},
              {'x': 'Bawa jas lab buat praktikum', 'day': 1}],
    'deadlines': [{'text': 'Rangkuman Sejarah bab 3', 'day': -1}, {'text': 'Essay Bahasa Inggris "My Dream Job"', 'day': 1},
                  {'text': 'Video ekosistem (Biologi)', 'day': 4, 'fast': True}, {'text': 'Laporan praktikum Kimia', 'day': 6},
                  {'text': 'Daftar lomba poster', 'day': 18}, {'text': 'Beli buku latihan UTBK', 'day': None}],
    'grades': [{'s': 'Matematika', 'v': 78, 'day': -20}, {'s': 'Matematika', 'v': 86, 'day': -6}, {'s': 'Fisika', 'v': 72, 'day': -12},
               {'s': 'Bahasa Inggris', 'v': 91, 'day': -9}, {'s': 'Biologi', 'v': 88, 'day': -4}, {'s': 'Sejarah', 'v': 84, 'day': -2, 'k': 'Tugas'}],
    'money': {
        'opening': 150000,
        'items': [{'name': 'Uang jajan', 'group': 'income', 'amount': 800000, 'day': 1}, {'name': 'Freelance', 'group': 'income', 'amount': 200000},
                  {'name': 'Makan & jajan', 'group': 'needs', 'amount': 300000}, {'name': 'Bensin', 'group': 'needs', 'amount': 120000},
                  {'name': 'Kuota', 'group': 'needs', 'amount': 60000, 'day': 10}, {'name': 'Langganan musik', 'group': 'wants', 'amount': 25000, 'day': 22},
                  {'name': 'Nongkrong', 'group': 'wants', 'amount': 150000}, {'name': 'Tabungan laptop', 'group': 'future', 'amount': 250000, 'target': 6000000}],
        'tx': [[m, d, name, a, note] for m in (2, 1, 0) for d, name, a, note in [
            (1, 'Uang jajan', 800000, ''), (3, 'Bensin', 40000, ''), (5, 'Makan & jajan', 55000, 'Bakso'), (8, 'Makan & jajan', 70000, 'Kantin seminggu'),
            (10, 'Kuota', 60000, ''), (12, 'Tabungan laptop', 250000 if m else 200000, ''), (14, 'Nongkrong', 85000 if m != 1 else 160000, 'Kopi'),
            (16, 'Bensin', 40000, ''), (18, 'Freelance', 150000 if m else 0, 'Desain poster'), (22, 'Langganan musik', 25000, ''),
            (24, 'Makan & jajan', 65000, ''), (27, 'Bensin', 40000, '')] if a],
        'lists': [{'list': 'must', 'title': 'Service motor', 'amount': 120000, 'day': 3}, {'list': 'buy', 'title': 'Buku latihan UTBK', 'amount': 95000},
                  {'list': 'buy', 'title': 'Tinta printer', 'amount': 45000}, {'list': 'quest', 'title': 'Nabung buat headphone', 'amount': 0}],
    },
}

data = {'source': 'data contoh (fiktif)', 'owner': 'Raka', 'demo': True,
        'sheets': [sekolah, rumah, belajar, olahraga, uang, prinsip, hiburan, link], 'seeds': seeds,
        'generated': datetime.now().strftime('%Y-%m-%d %H:%M')}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    with open(sys.argv[1], 'w', encoding='utf-8') as f:
        f.write('window.AIO_DATA = ')
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('demo data -> ' + sys.argv[1])
