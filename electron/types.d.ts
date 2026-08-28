declare module 'better-sqlite3';
declare module 'pdf-parse';
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
