import readline from "node:readline";
import fs from "fs/promises";
import path from "path";

export async function queryUser(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((res) => {
    const ask = () => {
      rl.question(query, (text) => {
        if (text === "y") {
          rl.close();

          return res(true);
        } else if (text === "n") {
          rl.close();

          return res(false);
        } else {
          console.log("Accepted inputs: y or n");
          ask();

          return;
        }
      });
    }

    ask();
  });
}

export async function envValues(query: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const envKeys = {
    "PROSHOP_USERNAME": "",
    "PROSHOP_PASSWORD": "",
    "PROSHOP_REALNAME": "",
  };

  const ask = async (key: string) => {
    return new Promise((res) => {
      rl.question(`Value for ${key}: `, (text) => {
        res(text);
      })
    }); 
  };

  const handleEnvLines = async () => {
    const envLines = [];

    for (const key of Object.keys(envKeys)) {
      const value = await ask(key);

      envLines.push(`${key}=${value}`);
    }

    const envContent = envLines.join("\n");

    await fs.writeFile(path.join(__dirname, '../../.env'), envContent, 'utf8');

    rl.close();
  }

  await handleEnvLines();
}