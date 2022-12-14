import type { NextPage } from "next";
import Head from "next/head";
import styles from "../styles/Home.module.css";

const Page401: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>401 Unauthorized</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <h1 className={styles.title}>401 Unauthorized</h1>
        <p className={styles.description}>
          Please provide a valid token to use this api.
        </p>
      </main>
    </div>
  );
};

export default Page401;
