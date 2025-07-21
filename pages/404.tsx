import type { NextPage } from "next";
import Head from "next/head";
import styles from "../styles/Home.module.css";

const Page401: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>404 Not Found</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <h1 className={styles.title}>404 Not Found</h1>
        <p className={styles.description}>
          The requested resource could not be found.
        </p>
      </main>
    </div>
  );
};

export default Page401;
