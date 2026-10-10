/** One source for inspector section keys and labels. */
export const contextSections=[
 {key:'1',section:'payload',label:'payload'},
 {key:'2',section:'provenance',label:'memory provenance'},
 {key:'3',section:'events',label:'events'},
 {key:'4',section:'instructions',label:'instructions'},
 {key:'5',section:'tools',label:'tools'},
 {key:'6',section:'input',label:'input'},
] as const
export const contextSectionHint=contextSections.map(s=>s.key+' '+s.label).join(' · ')

export type ContextSection=typeof contextSections[number]['section']
