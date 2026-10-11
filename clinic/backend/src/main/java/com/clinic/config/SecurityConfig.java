package com.clinic.config;

import com.clinic.security.CustomUserDetailsService;
import com.clinic.security.jwt.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Security defaults: stateless, deny-by-default, BCrypt password hashing.
 *
 * <p>Only liveness, authentication and documentation endpoints are public.
 * Everything else requires a JWT, and per-endpoint rules are expressed with
 * {@code @PreAuthorize} against the central permission matrix in
 * {@code RolePermissions}.
 */
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(com.clinic.security.jwt.JwtProperties.class)
public class SecurityConfig {

    // Always-allowed origins (hardcoded production domains)
    private static final List<String> DEFAULT_ALLOWED_ORIGINS = Arrays.asList(
            "https://yemom-hospital.vercel.app",
            "https://yemom-hospital-git-main-yemoms-projects.vercel.app",
            "https://hotel-managment-system.vercel.app",
            "https://hotel-managment-system-git-main-yemoms-projects.vercel.app",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://192.168.137.1:3000",
            "http://192.168.137.1:3001",
            "http://192.168.20.27:3000",
            "http://192.168.20.27:3001"
    );

    // Additional origins from environment / application.properties (e.g. CORS_ALLOWED_ORIGINS)
    @Value("${cors.allowed-origins:}")
    private String[] extraAllowedOrigins;

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ApiRequestLoggingFilter apiRequestLoggingFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final CustomUserDetailsService userDetailsService;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ApiRequestLoggingFilter apiRequestLoggingFilter,
            RateLimitingFilter rateLimitingFilter,
            CustomUserDetailsService userDetailsService) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.apiRequestLoggingFilter = apiRequestLoggingFilter;
        this.rateLimitingFilter = rateLimitingFilter;
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Deny by default: only the matchers below are reachable without a token.
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                ApiPaths.HEALTH,
                                ApiPaths.AUTH + "/login",
                                ApiPaths.AUTH + "/register",
                                ApiPaths.AUTH + "/refresh",
                                "/error",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/actuator/health",
                                "/actuator/health/**")
                        .permitAll()
                        .anyRequest().authenticated())
                // Return the API's JSON envelope instead of Spring's HTML error
                // pages: 401 when no valid token, 403 when the token is valid but
                // lacks the permission. The frontend distinguishes the two.
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((request, response, ex) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write(
                                    "{\"status\":401,\"message\":\"Authentication is required\"}");
                        })
                        .accessDeniedHandler((request, response, ex) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            response.getWriter().write(
                                    "{\"status\":403,\"message\":\"You do not have permission to access this resource\"}");
                        }))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(apiRequestLoggingFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Use allowedOriginPatterns so that dynamic local LAN origins (e.g. http://10.200.13.117:3001,
        // Wi-Fi/hotspot IPs, any localhost port) and Vercel domains are allowed alongside allowCredentials(true).
        // Spring reflects the requesting Origin in Access-Control-Allow-Origin, which is spec-compliant.
        List<String> patterns = new ArrayList<>();
        patterns.add("*"); // Matches any origin and reflects it in Access-Control-Allow-Origin
        if (extraAllowedOrigins != null) {
            for (String origin : extraAllowedOrigins) {
                if (origin != null && !origin.isBlank()) {
                    patterns.add(origin.trim());
                }
            }
        }
        configuration.setAllowedOriginPatterns(patterns);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        // Allow all headers so custom Axios/TanStack Query/tracing headers are never blocked
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList(
                "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After", "Authorization"));
        configuration.setAllowCredentials(true);
        // Long max-age means browsers only pay one preflight per session.
        configuration.setMaxAge(7200L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}