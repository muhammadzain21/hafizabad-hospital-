import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import heroImg from '@/assets/doctor-hero.svg'; // ensure you have an illustration asset here or replace path

const DoctorHero: React.FC = () => {
  const { user } = useAuth();

  return (
    <section className="relative overflow-hidden rounded-2xl shadow-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white max-w-5xl mx-auto">
      <div className="p-4 md:p-8 lg:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <div className="flex-1 z-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">
            Welcome, Dr. {user?.name?.split(' ')[0] || 'Doctor'}!
          </h2>
          <p className="text-white/90 text-base mb-4 max-w-md">
            Manage your patients, prescriptions and lab investigations effortlessly with your personalised dashboard.
          </p>
        </div>
        <img
          src={heroImg}
          alt="Doctor Illustration"
          className="w-36 md:w-40 lg:w-44 drop-shadow-xl rotate-3"
        />
      </div>
      {/* decorative blurred blob */}
      <div className="absolute -top-16 -left-16 w-64 h-64 bg-pink-400/30 rounded-full filter blur-3xl" />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-purple-400/30 rounded-full filter blur-3xl" />
    </section>
  );
};

export default DoctorHero;
