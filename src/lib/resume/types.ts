// Structured, editable resume model. Parsed best-effort from pasted/uploaded
// resume text, then fully editable in the UI before export.

export interface ResumeExperience {
  role: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  dates: string;
}

/** Any section that isn't summary/experience/education/skills (Writing,
 * Publications, Awards, Certifications, Projects, Speaking, etc.). */
export interface ResumeSection {
  heading: string;
  items: string[];
}

export interface ResumeData {
  name: string;
  /** Optional headline under the name, e.g. "Senior Product Designer". */
  headline: string;
  location: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  github?: string;
  substack?: string;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  /** Free-text, comma-separated skills. */
  skills: string;
  /** Every other section, preserved verbatim so nothing is dropped on export. */
  additionalSections?: ResumeSection[];
}

export function emptyExperience(): ResumeExperience {
  return { role: "", company: "", dates: "", bullets: [""] };
}

export function emptyEducation(): ResumeEducation {
  return { degree: "", school: "", dates: "" };
}
