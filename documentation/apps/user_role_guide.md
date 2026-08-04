# Panduan Penggunaan Aplikasi Berdasarkan Role

Dokumen ini menjelaskan role, ruang akses, dan alur penggunaan Oetak Learning Platform berdasarkan implementasi saat ini.

Prinsip utama role di aplikasi:

- Role platform terpisah dari role tenant/organization.
- App Owner bukan admin tenant. App Owner mengelola bisnis SaaS, subscription, tenant, learner individu, billing, audit, dan maintenance.
- Platform Content Library adalah sumber materi global untuk learner individu.
- Tenant course catalog adalah materi milik organisasi/tenant tertentu.
- Learner individu tidak membuat course global. Global course hanya dibuat melalui Content Studio oleh App Owner atau Content Manager.

## Ringkasan Role

| Role | Scope | Fokus penggunaan | Route utama |
| --- | --- | --- | --- |
| App Owner | Platform | Administrasi SaaS, subscription tenant, subscription learner individu, billing, audit, maintenance | `/admin` |
| Content Manager | Platform | Membuat dan mengelola Platform Content Library untuk learner individu | `/content` |
| Organization owner | Tenant | Memiliki organisasi, membuat organisasi, membuat course tenant, melihat konteks organisasi | `/dashboard`, `/dashboard/organization`, `/dashboard/builder` |
| Organization manager | Tenant | Mengelola operasional course tenant. Nilai internal lama adalah `admin`, tetapi UI menampilkannya sebagai Organization manager | `/dashboard`, `/dashboard/builder` |
| Teacher | Tenant | Membuat dan mengelola materi course untuk tenant tempat ia aktif | `/dashboard/builder` |
| Learner / Student | Tenant atau personal | Mengikuti course, menyelesaikan modul, assessment, AI Tutor, sertifikat | `/dashboard`, `/dashboard/courses`, `/dashboard/learning` |
| Individual learner | Personal | Belajar dari Platform Content Library dan melihat progress personal | `/dashboard`, `/dashboard/courses`, `/dashboard/learning` |

## Perbedaan Role Platform dan Tenant

Role platform disimpan di `app_admins` dan menentukan akses ke console tingkat aplikasi.

| Platform role | Hak akses |
| --- | --- |
| `owner` | Masuk ke App Owner Console (`/admin`) dan Content Studio (`/content`) |
| `admin` | Masuk ke App Owner Console (`/admin`) untuk administrasi operasional SaaS |
| `content` | Masuk ke Content Studio (`/content`) untuk mengelola materi global |

Role tenant disimpan di `organization_members` dan hanya berlaku di organisasi tertentu.

| Tenant role internal | Label UI | Hak akses utama |
| --- | --- | --- |
| `owner` | Organization owner | Mengelola organization context dan course tenant |
| `admin` | Organization manager | Mengelola course tenant dan melihat context organisasi |
| `teacher` | Teacher | Membuat dan mengelola course tenant |
| `student` | Learner | Belajar dari course yang dapat diakses |

Catatan penting: App Owner tidak otomatis menjadi admin tenant untuk semua tenant. App Owner console tidak dipakai untuk mengelola course catalog tenant.

## Account Type Saat Onboarding

`accountType` bukan role akses. Ini adalah pilihan profil awal pengguna.

| Account type | Arti |
| --- | --- |
| `individual` | Pengguna belajar secara mandiri dari Platform Content Library |
| `organization` | Pengguna membuat atau memakai konteks organisasi |

Jika user memilih account type organization dan membuat organisasi, user tersebut otomatis menjadi `Organization owner` pada organisasi baru.

## Akses Awal Semua Pengguna

1. Buka aplikasi, misalnya `http://localhost:3000` atau `http://localhost:3001` sesuai port dev server yang aktif.
2. Pilih `Sign Up` untuk membuat akun baru.
3. Isi nama, email, password, dan konfirmasi password.
4. Setelah berhasil, pengguna masuk ke `Dashboard`.
5. Jika onboarding muncul, isi profil belajar:
   - `Account type`: Individual learner atau Organization owner.
   - `Learning headline`: ringkasan kebutuhan belajar.
   - `Goals`: target belajar, dipisahkan koma.
   - `Interests`: minat/topik belajar, dipisahkan koma.
   - `Proficiency`: level kemampuan awal.
   - `Weekly study minutes`: target menit belajar per minggu.
6. Klik `Save onboarding`.

Jika memilih Organization owner, isi data organisasi. Setelah tersimpan, organisasi dibuat dan user menjadi owner organisasi tersebut.

## Login App Owner

Seed lokal membuat akun maintenance owner untuk development.

- Email: `owner@oetakstudio.local`
- Password: `Owner@2026!`
- Setelah login, App Owner diarahkan ke `/admin`.

App Owner dapat membuka:

- `/admin`: App Owner Console.
- `/content`: Content Studio untuk Platform Content Library.

## Menu Utama Learner dan Tenant

| Menu | Fungsi |
| --- | --- |
| Dashboard | Ringkasan course aktif, completed course, progress, sertifikat, rekomendasi, dan tenant context |
| Course Catalog | Mencari course global yang published dan course tenant yang dapat diakses user |
| My Learning | Melihat enrollment dan melanjutkan course |
| Organization | Membuat organisasi dan melihat organisasi tempat user menjadi member |
| Analytics | Melihat analytics personal dan rata-rata organisasi yang dapat diakses |
| Tenant Builder | Membuat course tenant untuk organisasi yang dikelola user |
| Certificates | Melihat sertifikat yang sudah diterbitkan |

## App Owner Console

Route: `/admin`

App Owner Console adalah area administrasi platform, bukan tenant course management.

Menu yang tersedia:

| Menu | Fungsi |
| --- | --- |
| Overview | Ringkasan tenant, learner, subscription, estimated MRR, usage, dan activity |
| Tenants | Melihat tenant dan mengelola subscription tenant |
| Learners | Melihat learner individu dan subscription personal |
| Subscriptions | Mengelola plan, status, seats, billing email, period end, dan notes |
| Billing | Melihat billing health, MRR estimate, plan distribution, dan plan catalog |
| Activity | Melihat audit activity terbaru |
| Settings | Melihat guardrail role owner, access boundary, dan konfigurasi operasional |

App Owner tidak mengelola:

- Course catalog tenant.
- Modul milik tenant tertentu.
- Progress belajar user secara manual.
- Role member tenant dari UI saat ini.

## Content Studio

Route: `/content`

Content Studio adalah area untuk mengelola Platform Content Library. Materi di sini bersifat global dan muncul untuk learner individu jika status course `published` dan `organizationId = null`.

Yang dapat mengakses Content Studio:

- App Owner (`app_admins.role = owner`).
- Content Manager (`app_admins.role = content`).

Yang dapat dilakukan:

1. Melihat inventory global course.
2. Melihat jumlah course, published course, module, dan learning minutes.
3. Membuat global course untuk Platform Content Library.
4. Menandai course sebagai `draft`, `published`, atau `archived`.
5. Menandai content sebagai `AI assisted`.

Catatan: Content Manager tidak diarahkan ke App Owner Console. Content Manager diarahkan ke `/content`.

## Panduan Untuk Individual Learner

Individual learner belajar dari Platform Content Library dan tidak membuat course global.

### Menggunakan Dashboard Personal

1. Buka `Dashboard`.
2. Lihat statistik `Active courses`, `Completed`, `Average progress`, dan `Certificates`.
3. Gunakan `Current learning` untuk melanjutkan course.
4. Gunakan `Recommended courses` untuk membuka course yang disarankan.
5. Jika `Tenant context` tidak menampilkan organisasi, user sedang memakai aplikasi sebagai individual learner.

### Mengambil Materi Belajar

1. Buka `Course Catalog`.
2. Cari course berdasarkan judul, kategori, atau deskripsi.
3. Pilih course dari Platform Content Library.
4. Klik `Open`.
5. Klik `Enroll course`.
6. Lanjutkan pembelajaran dari `My Learning`.

Individual learner tidak punya akses membuat course global melalui `Tenant Builder`. Jika user perlu membuat materi global, user harus diberi platform role `content` atau `owner` dan memakai `/content`.

## Panduan Untuk Learner / Student

Learner mengikuti pembelajaran dan menyelesaikan course yang tersedia untuk akunnya.

### Mencari dan Mengikuti Course

1. Buka `Course Catalog`.
2. Gunakan search dan filter category/level jika diperlukan.
3. Klik `Open` pada course.
4. Klik `Enroll course`.
5. Setelah berhasil, course muncul di `My Learning`.

### Menyelesaikan Modul

1. Buka course dari `My Learning` atau `Course Catalog`.
2. Di bagian `Learning modules`, klik `Start`.
3. Setelah mempelajari modul, klik `Mark complete`.
4. Ulangi sampai progress mencapai `100%`.

### Mengirim Assessment

1. Buka halaman detail course.
2. Pastikan sudah enroll.
3. Isi jawaban di bagian `Assessment`.
4. Klik `Submit for AI feedback`.
5. Baca score dan feedback.

### Menggunakan AI Tutor

1. Buka halaman detail course.
2. Tulis pertanyaan di panel `AI Tutor`.
3. Klik `Ask tutor`.
4. Baca jawaban dan saran lanjutan.

### Menerbitkan Sertifikat

1. Selesaikan seluruh modul sampai progress `100%`.
2. Buka halaman detail course.
3. Klik `Issue certificate`.
4. Sertifikat dapat dilihat di `Certificates`.

## Panduan Untuk Organization Owner

Organization owner adalah user yang membuat atau memiliki organisasi.

### Membuat Organisasi

Melalui onboarding:

1. Di `Dashboard`, pilih `Organization owner` pada `Account type`.
2. Isi data organisasi.
3. Klik `Save onboarding`.

Melalui halaman Organization:

1. Buka `Organization`.
2. Isi form `Create organization`:
   - `Name`
   - `Slug`
   - `Brand color`
   - `Description`
3. Klik `Create organization`.
4. Organisasi muncul di `Your organizations` dengan badge Organization owner.

### Membuat Course Tenant

1. Buka `Tenant Builder`.
2. Pilih organisasi pada field `Catalog scope`.
3. Isi data course:
   - `Title`
   - `Slug`
   - `Category`
   - `Level`
   - `Status`
   - `Price in cents`
   - `Description`
4. Susun module:
   - `Title`
   - `Type`: reading, video, interactive, quiz, atau assignment.
   - `Minutes`
   - `Summary`
   - `Content`
5. Klik `Create course`.

Course yang dibuat di Tenant Builder selalu terikat pada organisasi dan tidak menjadi global course.

## Panduan Untuk Organization Manager

Organization manager adalah pengelola operasional tenant. Nilai internal role ini adalah `admin`, tetapi UI menampilkannya sebagai Organization manager agar tidak tertukar dengan App Owner.

Yang dapat dilakukan:

1. Membuka Dashboard tenant context.
2. Membuat course tenant lewat `Tenant Builder` jika memiliki membership aktif.
3. Melihat course yang tersedia di `Course Catalog`.
4. Melihat analytics personal dan rata-rata organisasi yang dapat diakses.

Catatan: UI untuk mengundang member, mengubah role member, atau menonaktifkan member belum tersedia.

## Panduan Untuk Teacher

Teacher berfokus pada pembuatan materi untuk organisasi tempat ia aktif.

### Membuat Materi Course Tenant

1. Buka `Tenant Builder`.
2. Pilih organisasi tempat user memiliki role Teacher.
3. Isi informasi course.
4. Susun module berdasarkan urutan belajar.
5. Klik `Create course`.

Teacher tidak dapat membuat Platform Content Library kecuali juga diberi platform role `content` atau `owner`.

## Matriks Hak Akses

| Aktivitas | App Owner | Content Manager | Org Owner | Org Manager | Teacher | Learner/Student | Individual Learner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sign up/sign in | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Mengisi onboarding | Tidak perlu | Tidak perlu | Ya | Ya | Ya | Ya | Ya |
| Masuk App Owner Console `/admin` | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |
| Masuk Content Studio `/content` | Ya | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Mengelola subscription tenant/learner | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |
| Membuat Platform Content Library | Ya | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Membuat organisasi | Tidak fokus | Tidak fokus | Ya | Ya* | Ya* | Ya* | Ya* |
| Melihat organisasi yang diikuti | Jika punya membership | Jika punya membership | Ya | Ya | Ya | Ya | Jika punya membership |
| Membuat course tenant | Jika punya tenant role | Jika punya tenant role | Ya | Ya | Ya | Tidak | Tidak |
| Membuat course global dari dashboard | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |
| Browse course catalog | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Enroll course | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Update progress pribadi | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Submit assessment pribadi | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Menggunakan AI Tutor | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Issue certificate pribadi | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat analytics personal | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat rata-rata analytics organisasi | Jika punya membership | Jika punya membership | Ya | Ya | Ya | Jika punya membership | Jika punya membership |

`*` Saat ini setiap user login dapat membuat organisasi baru melalui halaman `Organization`; pembuat organisasi otomatis menjadi Organization owner.

## Batasan Saat Ini

- Belum ada UI untuk invite member organisasi.
- Belum ada UI untuk mengubah role member organisasi.
- Belum ada UI untuk menonaktifkan atau menghapus member organisasi.
- Belum ada UI lengkap untuk update/delete course; API sudah memiliki sebagian kontrol update/delete.
- Belum ada workflow approval/publish untuk Platform Content Library.
- Belum ada payment provider otomatis; subscription masih dikelola manual dari App Owner Console.
- Estimated MRR dihitung dari plan catalog internal, bukan transaksi payment nyata.
- AI Tutor memakai mock provider untuk development.
- Audit activity masih bergantung pada event yang sudah ditulis aplikasi; belum semua action penting tercatat.

## Rekomendasi Perbaikan

1. Tambahkan Member Management untuk tenant.
   - Invite user ke organisasi.
   - Ubah role member.
   - Nonaktifkan member.
   - Audit setiap perubahan role.

2. Tambahkan Content Review Workflow.
   - Draft -> Review -> Published -> Archived.
   - Pisahkan Content Author dan Content Publisher jika tim konten bertambah.
   - Tambahkan preview course sebelum publish.

3. Tambahkan UI Course Management.
   - Edit course.
   - Edit module.
   - Archive/delete course.
   - Riwayat perubahan materi.

4. Tambahkan subscription/payment integration.
   - Stripe atau provider lokal.
   - Webhook untuk status active, past_due, canceled.
   - Invoice dan receipt.

5. Perjelas entitlement course berdasarkan subscription.
   - Saat ini course catalog berbasis akses user/org dan publish status.
   - Perlu aturan paket: course mana untuk free, starter, pro, growth, enterprise.

6. Tambahkan role Support Operator jika dibutuhkan.
   - Role ini bisa membantu customer support tanpa akses billing penuh.
   - Aksesnya sebaiknya read-only dan diaudit.

7. Tambahkan test authorization.
   - Test bahwa learner tidak bisa membuat global course.
   - Test bahwa content role tidak bisa masuk `/admin`.
   - Test bahwa owner bisa masuk `/admin` dan `/content`.
   - Test bahwa teacher hanya bisa membuat course tenant tempat ia aktif.

## Rekomendasi Alur Testing Per Role

### Persiapan Akun Seed

Sebelum login dengan akun skenario, jalankan `npm run db:bootstrap` dari root repository. Perintah ini menjalankan migrasi lalu mengisi akun seed pada `DATABASE_URL` yang aktif. Aplikasi dan perintah bootstrap harus menggunakan `DATABASE_URL` yang sama.

Credential default untuk organisasi **SMA Merdeka Nusantara Demo** adalah:

| Role | Email | Password default |
| --- | --- | --- |
| Owner | `owner.sma-merdeka@oetakstudio.local` | `Scenario@2026!` |
| Admin | `admin.sma-merdeka@oetakstudio.local` | `Scenario@2026!` |
| Teacher | `teacher.siti@oetakstudio.local` | `Scenario@2026!` |
| Learner | `aisha.grade11@oetakstudio.local` | `Scenario@2026!` |
| Guardian | `parent.aisha@oetakstudio.local` | `Scenario@2026!` |

`SCENARIO_1_PASSWORD` mengganti password default untuk seluruh akun tersebut. Jika login gagal, jalankan kembali `npm run db:seed` dan pastikan nilai environment yang digunakan oleh aplikasi sama dengan terminal tempat seed dijalankan.

### Individual Learner

1. Buat akun baru melalui `Sign Up`.
2. Isi onboarding sebagai Individual learner.
3. Buka `Course Catalog`.
4. Enroll course dari Platform Content Library.
5. Selesaikan modul.
6. Submit assessment.
7. Gunakan AI Tutor.
8. Issue certificate setelah progress `100%`.

### Organization Owner

1. Buat akun baru melalui `Sign Up`.
2. Isi onboarding sebagai Organization owner atau buat organisasi dari `Organization`.
3. Buka `Tenant Builder`.
4. Pilih organisasi pada `Catalog scope`.
5. Buat course tenant.
6. Buka `Course Catalog` dan cek course.
7. Buka `Analytics` untuk melihat data organisasi.

### Organization Manager atau Teacher

1. Pastikan akun sudah memiliki membership organisasi dengan role yang sesuai.
2. Buka `Tenant Builder`.
3. Pilih organisasi yang tersedia.
4. Buat course tenant.
5. Cek course melalui `Course Catalog`.
6. Pantau data melalui `Analytics`.

### App Owner

1. Login dengan akun owner seed.
2. Buka `/admin`.
3. Cek menu Overview, Tenants, Learners, Subscriptions, Billing, Activity, Settings.
4. Update subscription tenant atau learner individu.
5. Buka `/content` jika perlu membuat materi global.
6. Gunakan menu account di kanan atas untuk logout.

### Content Manager

1. Pastikan user memiliki row `app_admins.role = content` dan status active.
2. Login ke aplikasi.
3. User diarahkan ke `/content`.
4. Buat global course.
5. Publish course.
6. Login sebagai individual learner dan pastikan course muncul di Course Catalog.
