import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
// A preview-only database. Production schema changes are handled by Sites migrations.
export function scoreDatabase(filename=':memory:'){
 if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
 const sqlite=new DatabaseSync(filename);
 sqlite.exec('CREATE TABLE IF NOT EXISTS __preview_score_migrations(name TEXT PRIMARY KEY)');
 for(const name of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  if(sqlite.prepare('SELECT name FROM __preview_score_migrations WHERE name=?').get(name))continue;
  sqlite.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  sqlite.prepare('INSERT INTO __preview_score_migrations(name) VALUES(?)').run(name);
 }
 return {prepare(sql){let parameters=[];return {bind(...values){parameters=values;return this},async all(){return {results:sqlite.prepare(sql).all(...parameters)}},async first(){return sqlite.prepare(sql).get(...parameters)||null},async run(){const result=sqlite.prepare(sql).run(...parameters);return {success:true,meta:{changes:Number(result.changes)}}}}},close(){sqlite.close()}};
}
