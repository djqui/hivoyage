package com.example.demo.config;

import com.example.demo.repository.UserRepository;
import com.example.demo.model.User;
import com.example.demo.security.CustomUserDetails;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    private final UserRepository userRepository;

    public SecurityConfig(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())  
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/welcome", "/login", "/signup", "/user/validate", 
                    "/forgotpassword", "/resetpassword", "/user/verify", "/styles/**", "/js/**"
                ).permitAll()  // Allow public access to signup, login, verification
                .requestMatchers("/user/profile/**").authenticated()  // Require authentication for profile
                .requestMatchers("/uploads/**").authenticated()  // Require authentication for uploaded files
                .anyRequest().authenticated()  // Require authentication for all other routes
            )
            .formLogin(login -> login
                .loginPage("/login")
                .defaultSuccessUrl("/user/homepage", true)
                .failureUrl("/login?error=true")
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .permitAll()
            )
            .sessionManagement(session -> session
                .maximumSessions(1) // Allow only one session per user
                .expiredUrl("/login?expired=true") // Redirect when session expires
            )
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // 🔹 Load UserDetails & Ensure Email Verification Before Login
    @Bean
    public UserDetailsService userDetailsService() {
        return email -> {
            User user = userRepository.findByEmail(email);
            if (user == null) {
                System.out.println("❌ User not found: " + email);
                throw new UsernameNotFoundException("User not found.");
            }
            if (!user.isEnabled()) {
                System.out.println("❌ User not verified: " + email);
                throw new UsernameNotFoundException("User email not verified. Please check your inbox.");
            }
            System.out.println("✅ User is verified and can log in: " + email);
            return new CustomUserDetails(user);
        };
    }

    // 🔹 Authentication Provider for Spring Security
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService());
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    // 🔹 Authentication Manager (Handles Login Authentication)
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
