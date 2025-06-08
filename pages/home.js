import React from 'react';
import More from "./More";
import Free from "./free";
import Dolphin from "./dolphin";
import Whale from "./whale";
import Head from "next/head";
import LogOut from "./logout";

export default function Home() {
    return (
      <div className="container mx-auto px-4 py-8">
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Group66</title>
        </Head>
        
        <h1 className="text-4xl font-bold mb-2 text-blue-800">Welcome to Group66</h1>
        <LogOut />
        
        <p className="mb-8 text-lg text-gray-600 max-w-3xl">
          Group66 allows users to easily deploy and manage vector databases for their LLMs within their own infrastructure.
          Customers can embed their data into these databases through a portal while keeping their proprietary LLMs and data secure.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Free />
          <Dolphin />
          <Whale />
        </div>
        
        <h3 className="text-2xl font-medium mb-6 text-blue-800">More about us</h3>
        <More />
        
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Group66. Katchow :)</p>
        </footer>
      </div>
    );
  }
  
