// Fungsi murni (tanpa browser, tanpa database) untuk mempersempit daftar project SOT
// ke project yang punya issue dengan Team Leader tertentu. Dipisah supaya bisa dites dengan `node --test`.

export const ISSUES_PER_PAGE = 100; // harus salah satu dari opsi "Per page" Redmine (25, 50, 100)

/** Kunci project = path URL tanpa garis miring akhir. Sama dengan external_key di tabel sot_projects. */
export function projectKey(link) {
  return new URL(link).pathname.replace(/\/+$/, "");
}

/**
 * URL daftar issue sebuah FY: semua status, Team Leader (custom field) sama dengan leaderId,
 * dengan kolom Project supaya kita tahu issue itu milik project yang mana.
 * Nomor halaman ditambahkan oleh pembaca (parameter `page`).
 */
export function buildIssuesUrl(fyLink, { leaderField = "cf_3", leaderId }) {
  const url = new URL(fyLink);
  url.pathname = url.pathname.replace(/\/+$/, "") + "/issues";
  url.search = "";
  url.hash = "";
  const p = url.searchParams;
  p.set("set_filter", "1");
  p.set("sort", "id:desc");
  p.append("f[]", "status_id");
  p.append("op[status_id]", "*"); // semua status: project yang issue-nya sudah closed tetap ikut
  p.append("f[]", leaderField);
  p.append(`op[${leaderField}]`, "=");
  p.append(`v[${leaderField}][]`, String(leaderId));
  p.append("c[]", "project");
  p.set("per_page", String(ISSUES_PER_PAGE));
  return url.toString();
}

/**
 * fys           : [{ label, link, projects: [{ name, link }] }]  (hasil readProjectList)
 * issueProjects : [{ href, name }]  project dari kolom Project pada daftar issue
 * Mengembalikan hanya project yang muncul di issue. FY yang jadi kosong dibuang.
 *   unmatched = nama project di issue yang tidak ada di daftar project (dan bukan FY itu sendiri)
 */
export function narrowFysByIssues(fys, issueProjects) {
  const wanted = new Map();
  for (const p of issueProjects) wanted.set(projectKey(p.href).toLowerCase(), p.name);

  const fyKeys = new Set(fys.map((fy) => projectKey(fy.link).toLowerCase()));
  const known = new Set();
  const narrowed = [];
  let total = 0;
  let kept = 0;
  for (const fy of fys) {
    total += fy.projects.length;
    const projects = fy.projects.filter((project) => {
      const key = projectKey(project.link).toLowerCase();
      known.add(key);
      return wanted.has(key);
    });
    kept += projects.length;
    if (projects.length > 0) narrowed.push({ ...fy, projects });
  }
  const unmatched = [...wanted].filter(([key]) => !known.has(key) && !fyKeys.has(key)).map(([, name]) => name);
  return { fys: narrowed, kept, total, unmatched };
}
